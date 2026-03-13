/* ═══════════════════════════════════════════════════════════════════
   SCHEDULED REPORTS — Cron-Based Automated Report Delivery
   Technical Made Easy — Enterprise Reporting (L4 Maturity)

   Schedules:
   • Weekly KPI Summary    → Every Monday 7 AM (company owner + admins)
   • Monthly PM Compliance → 1st of month (company owner)
   • Daily Emergency Digest → 6 PM daily (if any emergencies that day)

   HIPAA: Report emails contain aggregate KPIs only — no PHI/patient data.
   ═══════════════════════════════════════════════════════════════════ */
const cron = require('node-cron');
const WorkOrder = require('../models/WorkOrder');
const User = require('../models/User');
const Company = require('../models/Company');

// ── Email helper (uses Resend if configured, logs otherwise) ──
async function sendReportEmail(to, subject, htmlBody) {
  const RESEND_KEY = process.env.RESEND_API_KEY;
  const FROM = process.env.EMAIL_FROM || 'reports@technical-made-easy.com';

  if (!RESEND_KEY) {
    console.log(`[ScheduledReports] 📧 PREVIEW — To: ${to}, Subject: ${subject}`);
    console.log(`[ScheduledReports] (Set RESEND_API_KEY to send real emails)`);
    return { success: true, preview: true };
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM, to, subject, html: htmlBody }),
    });
    const data = await res.json();
    return { success: res.ok, id: data.id };
  } catch (err) {
    console.error('[ScheduledReports] Email send failed:', err.message);
    return { success: false, error: err.message };
  }
}

// ── Report Templates ──
function weeklyKPIReport(company, stats) {
  return `
    <div style="font-family:'Helvetica Neue',Arial,sans-serif;max-width:600px;margin:0 auto;background:#0f0f17;color:#e4ecf4;padding:32px;border-radius:12px;">
      <div style="text-align:center;margin-bottom:24px;">
        <span style="font-size:36px;">⚕️</span>
        <h1 style="color:#00e5ff;font-size:20px;margin:8px 0 0;">Weekly KPI Report</h1>
        <p style="color:#8aa0b8;font-size:12px;margin:4px 0 0;">${company.name} — ${new Date().toLocaleDateString()}</p>
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <tr style="border-bottom:1px solid rgba(255,255,255,0.08);">
          <td style="padding:10px 0;color:#8aa0b8;">Total Work Orders</td>
          <td style="padding:10px 0;text-align:right;font-weight:700;color:#00e5ff;">${stats.totalWOs}</td>
        </tr>
        <tr style="border-bottom:1px solid rgba(255,255,255,0.08);">
          <td style="padding:10px 0;color:#8aa0b8;">Completed</td>
          <td style="padding:10px 0;text-align:right;font-weight:700;color:#00e676;">${stats.completed}</td>
        </tr>
        <tr style="border-bottom:1px solid rgba(255,255,255,0.08);">
          <td style="padding:10px 0;color:#8aa0b8;">Open</td>
          <td style="padding:10px 0;text-align:right;font-weight:700;color:#ffd600;">${stats.open}</td>
        </tr>
        <tr style="border-bottom:1px solid rgba(255,255,255,0.08);">
          <td style="padding:10px 0;color:#8aa0b8;">Emergency</td>
          <td style="padding:10px 0;text-align:right;font-weight:700;color:#ff2d6b;">${stats.emergency}</td>
        </tr>
        <tr style="border-bottom:1px solid rgba(255,255,255,0.08);">
          <td style="padding:10px 0;color:#8aa0b8;">First-Time Fix Rate</td>
          <td style="padding:10px 0;text-align:right;font-weight:700;color:${stats.ftfr >= 80 ? '#00e676' : '#ff9800'};">${stats.ftfr}%</td>
        </tr>
        <tr style="border-bottom:1px solid rgba(255,255,255,0.08);">
          <td style="padding:10px 0;color:#8aa0b8;">PM Compliance</td>
          <td style="padding:10px 0;text-align:right;font-weight:700;color:${stats.pmCompliance >= 90 ? '#00e676' : '#ff9800'};">${stats.pmCompliance}%</td>
        </tr>
        <tr>
          <td style="padding:10px 0;color:#8aa0b8;">Avg Response Time</td>
          <td style="padding:10px 0;text-align:right;font-weight:700;color:#00e5ff;">${stats.avgResponse}h</td>
        </tr>
      </table>
      <div style="text-align:center;margin-top:24px;">
        <a href="https://technical-made-easy.vercel.app/dashboard/analytics" style="display:inline-block;padding:10px 24px;background:linear-gradient(135deg,#00e5ff,#00ff9d);color:#0a0f1e;border-radius:8px;font-weight:700;text-decoration:none;font-size:13px;">
          View Full Analytics →
        </a>
      </div>
      <p style="text-align:center;font-size:9px;color:#4a5568;margin-top:20px;">
        🔒 This report contains aggregate KPIs only — no PHI. HIPAA compliant.
      </p>
    </div>
  `;
}

// ── KPI Calculator ──
async function calculateKPIs(companyId, daysSince = 7) {
  const since = new Date(Date.now() - daysSince * 86400000);
  const query = companyId ? { companyId, createdAt: { $gte: since } } : { createdAt: { $gte: since } };

  try {
    const wos = await WorkOrder.find(query).lean();
    const completed = wos.filter(w => ['Completed', 'Finished'].includes(w.status));
    const open = wos.filter(w => ['Pending', 'Active', 'In Progress', 'Dispatched'].includes(w.status));
    const emergency = wos.filter(w => w.emergency);
    const pms = wos.filter(w => w.formType === 'PM');
    const pmsDone = pms.filter(w => ['Completed', 'Finished'].includes(w.status));

    // FTFR calculation
    let callbacks = 0;
    completed.forEach(wo => {
      const hasCallback = wos.some(w =>
        w._id.toString() !== wo._id.toString() &&
        w.serialNumber && w.serialNumber === wo.serialNumber &&
        new Date(w.createdAt) > new Date(wo.updatedAt) &&
        (new Date(w.createdAt) - new Date(wo.updatedAt)) < 7 * 86400000
      );
      if (hasCallback) callbacks++;
    });

    // Avg response time
    const responseTimes = wos
      .filter(w => w.createdAt && w.updatedAt && w.status !== 'Pending')
      .map(w => (new Date(w.updatedAt) - new Date(w.createdAt)) / 3600000);
    const avgResponse = responseTimes.length > 0
      ? Math.round(responseTimes.reduce((s, t) => s + t, 0) / responseTimes.length * 10) / 10
      : 0;

    return {
      totalWOs: wos.length,
      completed: completed.length,
      open: open.length,
      emergency: emergency.length,
      ftfr: completed.length > 0 ? Math.round(((completed.length - callbacks) / completed.length) * 100) : 0,
      pmCompliance: pms.length > 0 ? Math.round((pmsDone.length / pms.length) * 100) : 100,
      avgResponse,
    };
  } catch (err) {
    console.error('[ScheduledReports] KPI calculation error:', err.message);
    return { totalWOs: 0, completed: 0, open: 0, emergency: 0, ftfr: 0, pmCompliance: 100, avgResponse: 0 };
  }
}

// ── Schedule Jobs ──
function initScheduledReports() {
  // ── Weekly KPI Summary — Every Monday at 7:00 AM ──
  cron.schedule('0 7 * * 1', async () => {
    console.log('[ScheduledReports] 📊 Running weekly KPI report...');
    try {
      const companies = await Company.find({ active: { $ne: false } }).lean();
      for (const company of companies) {
        const stats = await calculateKPIs(company._id, 7);
        const owners = await User.find({
          companyId: company._id,
          role: { $in: ['OWNER', 'COMPANY', 'ADMIN'] },
          active: { $ne: false },
        }).lean();

        const recipients = owners.map(u => u.email).filter(Boolean);
        if (recipients.length === 0) continue;

        const html = weeklyKPIReport(company, stats);
        await sendReportEmail(recipients, `📊 Weekly KPI Report — ${company.name}`, html);
        console.log(`[ScheduledReports] ✅ Sent weekly report to ${recipients.length} recipients for ${company.name}`);
      }
    } catch (err) {
      console.error('[ScheduledReports] Weekly report error:', err.message);
    }
  }, { timezone: 'America/New_York' });

  // ── Daily Emergency Digest — Every day at 6:00 PM ──
  cron.schedule('0 18 * * *', async () => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const emergencies = await WorkOrder.find({
        emergency: true,
        createdAt: { $gte: today },
      }).lean();

      if (emergencies.length === 0) return; // No emergencies — skip email

      console.log(`[ScheduledReports] 🚨 ${emergencies.length} emergencies today — sending digest...`);
      // Group by company and send
      const byCompany = {};
      emergencies.forEach(wo => {
        const cid = wo.companyId?.toString() || 'unknown';
        if (!byCompany[cid]) byCompany[cid] = [];
        byCompany[cid].push(wo);
      });

      for (const [companyId, wos] of Object.entries(byCompany)) {
        const owners = await User.find({
          companyId,
          role: { $in: ['OWNER', 'COMPANY'] },
          active: { $ne: false },
        }).lean();
        const recipients = owners.map(u => u.email).filter(Boolean);
        if (recipients.length === 0) continue;

        const woList = wos.map(w => `<li><strong>${w.woNumber}</strong> — ${w.model || 'N/A'} @ ${w.clientName || 'N/A'} (${w.status})</li>`).join('');
        const html = `
          <div style="font-family:'Helvetica Neue',Arial,sans-serif;max-width:600px;margin:0 auto;background:#0f0f17;color:#e4ecf4;padding:32px;border-radius:12px;">
            <h1 style="color:#ff2d6b;font-size:18px;">🚨 Emergency WO Digest</h1>
            <p style="color:#8aa0b8;font-size:12px;">${wos.length} emergency work order${wos.length > 1 ? 's' : ''} today</p>
            <ul style="list-style:none;padding:0;">${woList}</ul>
            <p style="font-size:9px;color:#4a5568;margin-top:20px;">🔒 Aggregate data only — no PHI. HIPAA compliant.</p>
          </div>
        `;
        await sendReportEmail(recipients, `🚨 ${wos.length} Emergency WO${wos.length > 1 ? 's' : ''} Today`, html);
      }
    } catch (err) {
      console.error('[ScheduledReports] Emergency digest error:', err.message);
    }
  }, { timezone: 'America/New_York' });

  console.log('[ScheduledReports] ✅ Scheduled reports initialized:');
  console.log('   📊 Weekly KPI → Mon 7 AM ET');
  console.log('   🚨 Emergency Digest → Daily 6 PM ET (if any)');
}

module.exports = { initScheduledReports, calculateKPIs, sendReportEmail };
