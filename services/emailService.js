/* ═══════════════════════════════════════════════════════════════════
   Email Service — Technical Made Easy
   
   Sends transactional emails via Resend.
   Falls back to console logging if RESEND_API_KEY is not set.
   
   Usage:
     const { sendMfaEmail, sendNotification } = require('./emailService');
     await sendMfaEmail('user@example.com', '123456');
   ───────────────────────────────────────────────────────────────── */

const { Resend } = require('resend');

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const FROM_ADDRESS = process.env.EMAIL_FROM || 'Technical Made Easy <onboarding@resend.dev>';

// ── Brand colors ────────────────────────────────────────────────
const BRAND = {
  bg: '#0a0e1a',
  card: '#111827',
  cyan: '#00e5ff',
  cyanDark: '#0097a7',
  text: '#e0e0e0',
  textMuted: '#9e9e9e',
  border: '#1e293b',
};

/**
 * Generate the branded MFA email HTML template.
 */
function mfaEmailTemplate(code, userEmail) {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:${BRAND.bg};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.bg};padding:40px 20px;">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0" style="background:${BRAND.card};border:1px solid ${BRAND.border};border-radius:12px;overflow:hidden;">
        
        <!-- Header -->
        <tr><td style="background:linear-gradient(135deg,${BRAND.cyanDark},${BRAND.cyan});padding:24px 32px;text-align:center;">
          <div style="font-size:24px;font-weight:800;color:#fff;letter-spacing:1px;">⚕ Technical Made Easy</div>
          <div style="font-size:12px;color:rgba(255,255,255,0.8);margin-top:4px;">HIPAA-Compliant Medical Equipment Management</div>
        </td></tr>
        
        <!-- Body -->
        <tr><td style="padding:32px;">
          <div style="font-size:16px;color:${BRAND.text};margin-bottom:16px;">
            🔐 <strong>Verify Your Identity</strong>
          </div>
          <div style="font-size:14px;color:${BRAND.textMuted};margin-bottom:24px;line-height:1.5;">
            A sign-in attempt was detected for <strong style="color:${BRAND.cyan};">${userEmail}</strong>.
            Enter the code below to complete authentication.
          </div>
          
          <!-- Code Box -->
          <div style="background:${BRAND.bg};border:2px solid ${BRAND.cyan};border-radius:8px;padding:20px;text-align:center;margin-bottom:24px;">
            <div style="font-size:36px;font-weight:800;color:${BRAND.cyan};letter-spacing:12px;font-family:'Courier New',monospace;">
              ${code}
            </div>
          </div>
          
          <div style="font-size:12px;color:${BRAND.textMuted};line-height:1.5;">
            ⏱ This code expires in <strong style="color:${BRAND.text};">5 minutes</strong>.<br>
            🔒 If you did not request this code, ignore this email.<br>
            📋 HIPAA §164.312(d) — Multi-Factor Authentication Required
          </div>
        </td></tr>
        
        <!-- Footer -->
        <tr><td style="padding:16px 32px;border-top:1px solid ${BRAND.border};text-align:center;">
          <div style="font-size:11px;color:${BRAND.textMuted};">
            © ${new Date().getFullYear()} Technical Made Easy · All access is logged and monitored
          </div>
        </td></tr>
        
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

/**
 * Send MFA verification code email.
 * @param {string} to - Recipient email
 * @param {string} code - 6-digit MFA code
 * @returns {Promise<{success: boolean, id?: string, error?: string}>}
 */
async function sendMfaEmail(to, code) {
  console.log(`[Email] 📧 Sending MFA code to ${to}`);
  
  if (!resend) {
    console.warn('[Email] ⚠️ RESEND_API_KEY not set — email not sent. Code:', code);
    return { success: false, error: 'Email service not configured' };
  }

  try {
    const { data, error } = await resend.emails.send({
      from: FROM_ADDRESS,
      to: [to],
      subject: `🔐 Your verification code: ${code}`,
      html: mfaEmailTemplate(code, to),
    });

    if (error) {
      console.error('[Email] ❌ Send failed:', error);
      return { success: false, error: error.message };
    }

    console.log(`[Email] ✅ MFA email sent to ${to} (id: ${data.id})`);
    return { success: true, id: data.id };
  } catch (err) {
    console.error('[Email] ❌ Exception:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Send a generic notification email.
 */
async function sendNotification(to, subject, htmlBody) {
  if (!resend) {
    console.warn('[Email] ⚠️ RESEND_API_KEY not set — notification not sent');
    return { success: false, error: 'Email service not configured' };
  }

  try {
    const { data, error } = await resend.emails.send({
      from: FROM_ADDRESS,
      to: Array.isArray(to) ? to : [to],
      subject,
      html: htmlBody,
    });

    if (error) {
      console.error('[Email] ❌ Notification send failed:', error);
      return { success: false, error: error.message };
    }

    return { success: true, id: data.id };
  } catch (err) {
    console.error('[Email] ❌ Exception:', err.message);
    return { success: false, error: err.message };
  }
}

module.exports = { sendMfaEmail, sendNotification };
