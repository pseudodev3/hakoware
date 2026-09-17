const nodemailer = require('nodemailer');

const smtpHost = process.env.SMTP_HOST || 'smtp-relay.brevo.com';
const smtpPort = Number(process.env.SMTP_PORT) || 587;
const smtpUser = String(process.env.SMTP_USER || '').trim();
const smtpPass = String(process.env.SMTP_PASS || '').trim();
const frontendUrl = String(process.env.FRONTEND_URL || '').replace(/\/$/, '');
const fromAddress = String(process.env.EMAIL_FROM || '').trim();
const replyTo = String(process.env.EMAIL_REPLY_TO || '').trim();

const emailConfigured = Boolean(smtpUser && smtpPass && fromAddress);

const transporter = emailConfigured ? nodemailer.createTransport({
  pool: true,
  host: smtpHost,
  port: smtpPort,
  secure: smtpPort === 465,
  auth: {
    user: smtpUser,
    pass: smtpPass
  },
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 15000
}) : null;

const escapeHtml = (value = '') => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');

const shell = ({ eyebrow, title, body, actionLabel, actionUrl, footnote }) => `
<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#0a0a08;color:#f7f4ec;font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
    <div style="max-width:560px;margin:0 auto;padding:36px 18px">
      <div style="padding:32px;border-radius:22px;background:#151510;border:1px solid rgba(247,244,236,.1)">
        <div style="margin-bottom:28px;color:#e7b35a;font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase">${eyebrow}</div>
        <h1 style="margin:0;color:#f7f4ec;font-size:26px;line-height:1.15;font-weight:650;letter-spacing:-.03em">${title}</h1>
        <div style="margin-top:16px;color:#b8b3a7;font-size:15px;line-height:1.65">${body}</div>
        ${actionLabel && actionUrl ? `<div style="margin-top:28px"><a href="${escapeHtml(actionUrl)}" style="display:inline-block;padding:12px 17px;border-radius:11px;background:#e7b35a;color:#171009;text-decoration:none;font-size:14px;font-weight:650">${actionLabel}</a></div>` : ''}
        ${footnote ? `<div style="margin-top:28px;padding-top:18px;border-top:1px solid rgba(247,244,236,.08);color:#777268;font-size:12px;line-height:1.55">${footnote}</div>` : ''}
      </div>
      <div style="padding:14px 4px 0;color:#555149;font-size:11px">Hakoware · Social pressure, Duo progression, mild consequences.</div>
    </div>
  </body>
</html>`;

const send = async ({ to, subject, text, html, required = false }) => {
  if (!transporter) {
    const error = new Error('Email delivery is not configured');
    if (required) throw error;
    return false;
  }

  try {
    await transporter.sendMail({
      from: fromAddress,
      ...(replyTo ? { replyTo } : {}),
      to,
      subject,
      text,
      html
    });
    return true;
  } catch (error) {
    if (required) throw error;
    console.error(`Email delivery failed (${subject}):`, error.message);
    return false;
  }
};

const getEmailStatus = () => ({
  configured: emailConfigured,
  provider: 'brevo-smtp',
  host: smtpHost,
  port: smtpPort,
  from: fromAddress || null
});

const verifyEmailTransport = async () => {
  if (!transporter) return { ...getEmailStatus(), verified: false };
  try {
    await transporter.verify();
    return { ...getEmailStatus(), verified: true };
  } catch (error) {
    return { ...getEmailStatus(), verified: false, error: error.message };
  }
};

const sendResetPasswordEmail = async (userEmail, resetUrl) => send({
  required: true,
  to: userEmail,
  subject: 'Reset your Hakoware password',
  text: `A password reset was requested for your Hakoware account. Open this link within one hour: ${resetUrl}\n\nIf you did not request this, you can ignore this email.`,
  html: shell({
    eyebrow: 'Account recovery',
    title: 'Reset your password.',
    body: '<p style="margin:0">A password reset was requested for your Hakoware account. This link expires in one hour.</p>',
    actionLabel: 'Reset password',
    actionUrl: resetUrl,
    footnote: 'If you did not request this, you can safely ignore this email.'
  })
});

const sendWelcomeEmail = async (userEmail, userName) => {
  const safeName = escapeHtml(userName);
  return send({
    to: userEmail,
    subject: 'Welcome to Hakoware',
    text: `Welcome to Hakoware, ${userName}. Your account is ready. Pick one person, start a contract, and survive Season 1.`,
    html: shell({
      eyebrow: 'Player registered',
      title: `Welcome, ${safeName}.`,
      body: '<p style="margin:0">Your account is ready. Pick one person, choose a contract mode, and let Season 1 start keeping score.</p>',
      actionLabel: frontendUrl ? 'Enter Hakoware' : null,
      actionUrl: frontendUrl || null,
      footnote: 'Check-ins build Duo XP. Silence builds debt. Chaos makes its own rules.'
    })
  });
};

const sendFriendRequestEmail = async (toEmail, fromName, requiresSignup = false) => {
  const safeName = escapeHtml(fromName);
  const destination = requiresSignup ? `${frontendUrl}/?join=1` : frontendUrl;
  return send({
    to: toEmail,
    subject: `${fromName} challenged you on Hakoware`,
    text: requiresSignup
      ? `${fromName} sent you a Hakoware contract. Sign up with this email address to claim it: ${destination}`
      : `${fromName} sent you a Hakoware contract. Open Hakoware to review it: ${destination}`,
    html: shell({
      eyebrow: 'Challenge received',
      title: `${safeName} put you under contract.`,
      body: `<p style="margin:0">${requiresSignup ? 'Create your Hakoware account with this email address and the challenge will already be waiting for you.' : 'Open Hakoware to review the challenge and decide whether Season 1 starts.'}</p>`,
      actionLabel: requiresSignup ? 'Claim challenge' : 'Review challenge',
      actionUrl: destination,
      footnote: 'Accepting starts the season: Duo XP, Aura, debt and Arena pressure included.'
    })
  });
};

module.exports = {
  getEmailStatus,
  verifyEmailTransport,
  sendResetPasswordEmail,
  sendWelcomeEmail,
  sendFriendRequestEmail
};
