/**
 * ═══════════════════════════════════════════════════════════════
 * STRIPE PAYMENT PROCESSING
 * Enables clients to pay invoices directly via Stripe Checkout
 *
 * Routes:
 *   POST /api/v1/stripe/create-checkout  — Create payment link
 *   POST /api/v1/stripe/webhook          — Handle Stripe events
 *   GET  /api/v1/stripe/payment-status   — Check payment status
 *
 * HIPAA Note: No PHI is sent to Stripe. Only invoice numbers
 * and amounts are transmitted. Patient data stays in MongoDB.
 * ═══════════════════════════════════════════════════════════════
 */

const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const WorkOrder = require('../models/WorkOrder');
const AuditLog = require('../models/AuditLog');

// Initialize Stripe with secret key
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// ═══════════════════════════════════════════════════════════════
// CREATE CHECKOUT SESSION — Generate a Stripe payment link
// @route    POST api/v1/stripe/create-checkout
// @body     { woId, successUrl?, cancelUrl? }
// @access   Private (COMPANY, ADMIN, OFFICE, CLIENT)
// ═══════════════════════════════════════════════════════════════
router.post('/create-checkout', auth, async (req, res) => {
  try {
    const { woId, successUrl, cancelUrl } = req.body;
    if (!woId) return res.status(400).json({ msg: 'Work order ID required' });

    const wo = await WorkOrder.findById(woId);
    if (!wo) return res.status(404).json({ msg: 'Work order not found' });

    if (!wo.invoiceTotal || wo.invoiceTotal <= 0) {
      return res.status(400).json({ msg: 'Invoice has no total. Generate invoice first.' });
    }

    if (wo.paymentStatus === 'paid') {
      return res.status(400).json({ msg: 'Invoice already paid' });
    }

    // Create Stripe Checkout Session
    // HIPAA: Only invoice number and amount sent — NO patient data
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: `Invoice ${wo.invoiceNumber || 'N/A'}`,
            description: `Service: ${wo.woType || 'Equipment Service'} — ${wo.woNumber || ''}`.substring(0, 200),
          },
          unit_amount: Math.round(wo.invoiceTotal * 100), // Stripe uses cents
        },
        quantity: 1,
      }],
      metadata: {
        woId: wo._id.toString(),
        invoiceNumber: wo.invoiceNumber || '',
        woNumber: wo.woNumber || '',
      },
      success_url: successUrl || `${process.env.FRONTEND_URL || 'https://technical-made-easy.com'}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl || `${process.env.FRONTEND_URL || 'https://technical-made-easy.com'}/billing`,
    });

    // Update WO with Stripe session ID
    await WorkOrder.findByIdAndUpdate(woId, {
      $set: {
        stripeSessionId: session.id,
        stripePaymentUrl: session.url,
        paymentStatus: 'checkout_pending',
      }
    });

    await AuditLog.create({
      action: 'STRIPE_CHECKOUT_CREATED',
      userId: req.user.id,
      companyId: req.user.companyId || wo.companyId,
      targetType: 'workOrder',
      targetId: wo._id.toString(),
      details: `Stripe checkout created for ${wo.invoiceNumber}. Amount: $${wo.invoiceTotal}`,
    });

    res.json({
      success: true,
      sessionId: session.id,
      checkoutUrl: session.url,
      invoiceNumber: wo.invoiceNumber,
      amount: wo.invoiceTotal,
    });
  } catch (err) {
    console.error('Stripe Checkout Error:', err.message);
    res.status(500).json({ msg: 'Payment processing error', error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// WEBHOOK — Handle Stripe payment events
// @route    POST api/v1/stripe/webhook
// @access   Public (verified by Stripe signature)
//
// NOTE: This route must use raw body parsing (express.raw)
// Configure in server.js BEFORE express.json() middleware
// ═══════════════════════════════════════════════════════════════
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    if (endpointSecret && sig) {
      event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    } else {
      // Development: no webhook secret verification
      event = JSON.parse(req.body.toString());
    }
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).json({ error: 'Webhook signature verification failed' });
  }

  // Handle the event
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      const woId = session.metadata?.woId;

      if (woId) {
        const wo = await WorkOrder.findByIdAndUpdate(woId, {
          $set: {
            paymentStatus: 'paid',
            paidAt: new Date(),
            paymentMethod: 'stripe',
            stripePaymentIntentId: session.payment_intent,
            status: 'Finished',
            subStatus: 'Paid & Archived',
          }
        }, { new: true });

        if (wo) {
          await AuditLog.create({
            action: 'STRIPE_PAYMENT_RECEIVED',
            userId: 'stripe-webhook',
            companyId: wo.companyId,
            targetType: 'workOrder',
            targetId: woId,
            details: `Payment received via Stripe for ${wo.invoiceNumber}. Amount: $${(session.amount_total / 100).toFixed(2)}. PI: ${session.payment_intent}`,
          });
          console.log(`✅ Payment received for ${wo.invoiceNumber}: $${(session.amount_total / 100).toFixed(2)}`);
        }
      }
      break;
    }

    case 'checkout.session.expired': {
      const session = event.data.object;
      const woId = session.metadata?.woId;
      if (woId) {
        await WorkOrder.findByIdAndUpdate(woId, {
          $set: { paymentStatus: 'invoiced', stripeSessionId: null }
        });
      }
      break;
    }

    default:
      // Unhandled event type
      break;
  }

  res.json({ received: true });
});

// ═══════════════════════════════════════════════════════════════
// CHECK PAYMENT STATUS — Verify if a Stripe session was paid
// @route    GET api/v1/stripe/payment-status/:sessionId
// @access   Private
// ═══════════════════════════════════════════════════════════════
router.get('/payment-status/:sessionId', auth, async (req, res) => {
  try {
    const session = await stripe.checkout.sessions.retrieve(req.params.sessionId);
    const wo = await WorkOrder.findOne({ stripeSessionId: req.params.sessionId });

    res.json({
      status: session.payment_status,
      amountTotal: session.amount_total / 100,
      customerEmail: session.customer_details?.email || null,
      invoiceNumber: wo?.invoiceNumber,
      woNumber: wo?.woNumber,
      paid: session.payment_status === 'paid',
    });
  } catch (err) {
    console.error('Payment status check error:', err.message);
    res.status(500).json({ msg: 'Error checking payment status' });
  }
});

module.exports = router;
