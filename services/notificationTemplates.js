/**
 * ═══════════════════════════════════════════════════════════════════
 * EMAIL NOTIFICATION TEMPLATES
 * Technical Made Easy — Transactional Email Templates
 *
 * Uses Resend for delivery. All templates are branded and professional.
 * ═══════════════════════════════════════════════════════════════════
 */

const { Resend } = require('resend');
const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_EMAIL = process.env.EMAIL_FROM || 'Technical Made Easy <noreply@send.technical-made-easy.com>';

// ── Base HTML wrapper ──
function wrapHTML(body, preheader = '') {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  body { margin: 0; padding: 0; background: #0d1117; color: #c9d1d9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
  .container { max-width: 600px; margin: 0 auto; padding: 24px; }
  .header { text-align: center; padding: 24px 0; border-bottom: 1px solid #1f2937; }
  .logo { font-size: 20px; font-weight: 700; color: #00d4ff; letter-spacing: 1px; }
  .content { padding: 32px 0; }
  .card { background: #161b22; border: 1px solid #1f2937; border-radius: 12px; padding: 24px; margin: 16px 0; }
  .badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; }
  .badge-active { background: rgba(0,212,255,0.15); color: #00d4ff; }
  .badge-complete { background: rgba(16,185,129,0.15); color: #10b981; }
  .badge-emergency { background: rgba(239,68,68,0.15); color: #ef4444; }
  h2 { color: #f0f6fc; margin: 0 0 8px; }
  .label { color: #8b949e; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; }
  .value { color: #f0f6fc; font-size: 16px; font-weight: 500; }
  .btn { display: inline-block; padding: 12px 28px; background: linear-gradient(135deg, #00d4ff, #7c3aed); color: #fff; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 16px 0; }
  .footer { text-align: center; padding: 24px 0; border-top: 1px solid #1f2937; color: #484f58; font-size: 12px; }
  .sla-bar { height: 6px; border-radius: 3px; background: #1f2937; margin: 12px 0; }
  .sla-fill { height: 6px; border-radius: 3px; }
</style></head>
<body><div class="container">
  <div style="display:none;max-height:0;overflow:hidden">${preheader}</div>
  <div class="header"><div class="logo">⚕️ TECHNICAL MADE EASY</div></div>
  <div class="content">${body}</div>
  <div class="footer">
    © ${new Date().getFullYear()} Technical Made Easy · HIPAA Compliant<br/>
    <a href="https://technical-made-easy.vercel.app" style="color:#00d4ff">Portal</a> · 
    <a href="mailto:support@technical-made-easy.com" style="color:#00d4ff">Support</a>
  </div>
</div></body></html>`;
}

// ══════════════════════════════════════════════════════════════
// TEMPLATE: Work Order Created (sent to client)
// ══════════════════════════════════════════════════════════════
async function sendWOCreatedEmail(to, wo, companyName) {
  const priorityBadge = wo.emergency
    ? '<span class="badge badge-emergency">⚡ EMERGENCY</span>'
    : '<span class="badge badge-active">📋 ' + (wo.priority || 'Normal').toUpperCase() + '</span>';

  const body = `
    <h2>Service Request Created</h2>
    <p style="color:#8b949e">Your work order has been submitted and is being processed.</p>
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
        <span style="color:#00d4ff;font-size:18px;font-weight:700">${wo.woNumber}</span>
        ${priorityBadge}
      </div>
      <div style="margin:8px 0"><span class="label">Equipment</span><br/><span class="value">${wo.model || 'N/A'} — ${wo.serialNumber || ''}</span></div>
      <div style="margin:8px 0"><span class="label">Location</span><br/><span class="value">${wo.site || ''} ${wo.building ? '· ' + wo.building : ''} ${wo.location ? '· ' + wo.location : ''}</span></div>
      <div style="margin:8px 0"><span class="label">Issue</span><br/><span class="value">${wo.customerIssue || 'No description provided'}</span></div>
      <div style="margin:8px 0"><span class="label">Service Company</span><br/><span class="value">${companyName}</span></div>
    </div>
    <div style="text-align:center">
      <a href="https://technical-made-easy.vercel.app" class="btn">Track Your Work Order →</a>
    </div>
    <p style="color:#484f58;font-size:13px;text-align:center">A technician will be assigned shortly. You'll receive updates as the work progresses.</p>`;

  return resend.emails.send({ from: FROM_EMAIL, to, subject: `[WO ${wo.woNumber}] Service Request Created`, html: wrapHTML(body, `Work order ${wo.woNumber} created.`) });
}

// ══════════════════════════════════════════════════════════════
// TEMPLATE: Work Order Completed (sent to client)
// ══════════════════════════════════════════════════════════════
async function sendWOCompletedEmail(to, wo, companyName, techName) {
  const body = `
    <h2>Service Complete ✅</h2>
    <p style="color:#8b949e">Your work order has been completed by ${techName}.</p>
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
        <span style="color:#10b981;font-size:18px;font-weight:700">${wo.woNumber}</span>
        <span class="badge badge-complete">✅ COMPLETE</span>
      </div>
      <div style="margin:8px 0"><span class="label">Equipment</span><br/><span class="value">${wo.model || 'N/A'}</span></div>
      <div style="margin:8px 0"><span class="label">Technician</span><br/><span class="value">${techName}</span></div>
      <div style="margin:8px 0"><span class="label">Completed</span><br/><span class="value">${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span></div>
      ${wo.woNotes ? `<div style="margin:8px 0"><span class="label">Service Notes</span><br/><span class="value">${wo.woNotes}</span></div>` : ''}
    </div>
    <div style="text-align:center">
      <a href="https://technical-made-easy.vercel.app" class="btn">View Service Report →</a>
    </div>
    <p style="color:#484f58;font-size:13px;text-align:center">A detailed service report and invoice will follow. Please rate your experience in the Client Portal.</p>`;

  return resend.emails.send({ from: FROM_EMAIL, to, subject: `[WO ${wo.woNumber}] Service Complete ✅`, html: wrapHTML(body, `Work order ${wo.woNumber} completed by ${techName}.`) });
}

// ══════════════════════════════════════════════════════════════
// TEMPLATE: PM Due Reminder (sent to office/admin)
// ══════════════════════════════════════════════════════════════
async function sendPMDueReminder(to, wo, daysUntilDue) {
  const urgency = daysUntilDue <= 3 ? 'badge-emergency' : 'badge-active';
  const body = `
    <h2>⏰ PM Due in ${daysUntilDue} Day${daysUntilDue === 1 ? '' : 's'}</h2>
    <p style="color:#8b949e">A preventive maintenance work order is approaching its due date.</p>
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
        <span style="color:#f59e0b;font-size:18px;font-weight:700">${wo.woNumber}</span>
        <span class="badge ${urgency}">📅 Due ${daysUntilDue === 0 ? 'TODAY' : `in ${daysUntilDue}d`}</span>
      </div>
      <div style="margin:8px 0"><span class="label">Client</span><br/><span class="value">${wo.clientName || 'N/A'}</span></div>
      <div style="margin:8px 0"><span class="label">Equipment</span><br/><span class="value">${wo.model || 'N/A'} — ${wo.serialNumber || ''}</span></div>
      <div style="margin:8px 0"><span class="label">Location</span><br/><span class="value">${wo.site || ''} ${wo.location ? '· ' + wo.location : ''}</span></div>
    </div>
    <div style="text-align:center">
      <a href="https://technical-made-easy.vercel.app" class="btn">Assign Technician →</a>
    </div>`;

  return resend.emails.send({ from: FROM_EMAIL, to, subject: `[PM ${wo.woNumber}] Due in ${daysUntilDue} day${daysUntilDue === 1 ? '' : 's'}`, html: wrapHTML(body, `PM ${wo.woNumber} is due in ${daysUntilDue} days.`) });
}

// ══════════════════════════════════════════════════════════════
// TEMPLATE: SLA Breach Alert (sent to admin/owner)
// ══════════════════════════════════════════════════════════════
async function sendSLABreachAlert(to, wo) {
  const body = `
    <h2>🚨 SLA Breach Alert</h2>
    <p style="color:#ef4444;font-weight:600">Work order ${wo.woNumber} has exceeded its SLA deadline.</p>
    <div class="card" style="border-color:#ef4444">
      <div style="margin:8px 0"><span class="label">WO Number</span><br/><span class="value" style="color:#ef4444">${wo.woNumber}</span></div>
      <div style="margin:8px 0"><span class="label">Client</span><br/><span class="value">${wo.clientName || 'N/A'}</span></div>
      <div style="margin:8px 0"><span class="label">Priority</span><br/><span class="value">${wo.emergency ? '⚡ EMERGENCY' : (wo.priority || 'Normal').toUpperCase()}</span></div>
      <div style="margin:8px 0"><span class="label">SLA Deadline</span><br/><span class="value" style="color:#ef4444">${wo.sla?.deadline ? new Date(wo.sla.deadline).toLocaleString() : 'N/A'}</span></div>
      <div style="margin:8px 0"><span class="label">Assigned Tech</span><br/><span class="value">${wo.assignedTechName || '⚠️ UNASSIGNED'}</span></div>
    </div>
    <div style="text-align:center">
      <a href="https://technical-made-easy.vercel.app" class="btn" style="background:linear-gradient(135deg,#ef4444,#b91c1c)">Take Action →</a>
    </div>`;

  return resend.emails.send({ from: FROM_EMAIL, to, subject: `🚨 [SLA BREACH] ${wo.woNumber} — Immediate Action Required`, html: wrapHTML(body, `SLA breach on ${wo.woNumber}. Immediate action required.`) });
}

module.exports = {
  sendWOCreatedEmail,
  sendWOCompletedEmail,
  sendPMDueReminder,
  sendSLABreachAlert,
};
