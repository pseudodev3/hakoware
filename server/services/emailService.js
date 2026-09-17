const nodemailer = require('nodemailer');

const smtpPort = Number(process.env.SMTP_PORT) || 587;
const frontendUrl = (process.env.FRONTEND_URL || '').replace(/\/$/, '');
const fromAddress = process.env.EMAIL_FROM || process.env.SMTP_USER;
const emailConfigured = Boolean(process.env.SMTP_USER && (process.env.SMTP_PASS || process.env.BREVO_API_KEY) && fromAddress);

const transporter = emailConfigured ? nodemailer.createTransport({
  pool: true,
  host: process.env.SMTP_HOST || 'smtp-relay.brevo.com',
  port: smtpPort,
  secure: smtpPort === 465,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS || process.env.BREVO_API_KEY
  }
}) : null;

const sendResetPasswordEmail = async (userEmail, resetUrl) => {
  if (!transporter) throw new Error('Email delivery is not configured');

  await transporter.sendMail({
    from: fromAddress,
    to: userEmail,
    subject: 'Hakoware password reset',
    html: `
      <div style="background:#0a0a0b;color:#f7f4ec;padding:40px;font-family:system-ui,-apple-system,sans-serif;border:1px solid #28271f;border-radius:16px">
        <h1 style="font-size:20px">Hakoware</h1>
        <p>A password reset was requested for your account.</p>
        <p style="color:#a8a399">Use the button below to choose a new password. This link expires in one hour.</p>
        <div style="margin:32px 0">
          <a href="${resetUrl}" style="display:inline-block;background:#e7b35a;color:#141009;padding:12px 18px;text-decoration:none;border-radius:10px;font-weight:650">Reset password</a>
        </div>
        <p style="font-size:12px;color:#777268">If you did not request this, you can ignore this email.</p>
      </div>
    `
  });
  return true;
};

const sendWelcomeEmail = async (userEmail, userName) => {
  if (!transporter) return false;
  try {
    await transporter.sendMail({
      from: fromAddress,
      to: userEmail,
      subject: 'Welcome to Hakoware',
      html: `
        <div style="background:#0a0a0b;color:#f7f4ec;padding:40px;font-family:system-ui,-apple-system,sans-serif;border:1px solid #28271f;border-radius:16px">
          <h1 style="font-size:20px">Hakoware</h1>
          <p>Welcome, <strong>${userName}</strong>.</p>
          <p style="color:#a8a399">Your account is ready. Create a contract, check in with friends and build Aura.</p>
        </div>
      `
    });
    return true;
  } catch (error) {
    console.error('Welcome email failed:', error.message);
    return false;
  }
};

const sendFriendRequestEmail = async (toEmail, fromName, requiresSignup = false) => {
  if (!transporter) return false;
  try {
    const destination = requiresSignup ? `${frontendUrl}/?join=1` : frontendUrl;
    await transporter.sendMail({
      from: fromAddress,
      to: toEmail,
      subject: `${fromName} sent you a Hakoware contract`,
      html: `
        <div style="background:#0a0a0b;color:#f7f4ec;padding:40px;font-family:system-ui,-apple-system,sans-serif;border:1px solid #28271f;border-radius:16px">
          <h1 style="font-size:20px">Hakoware</h1>
          <p><strong>${fromName}</strong> sent you a contract request.</p>
          <p style="color:#a8a399">${requiresSignup ? 'Sign up with this email address and the request will be waiting for you.' : 'Open Hakoware to review the request.'}</p>
          <div style="margin:32px 0">
            <a href="${destination}" style="display:inline-block;background:#e7b35a;color:#141009;padding:12px 18px;text-decoration:none;border-radius:10px;font-weight:650">Open contract</a>
          </div>
        </div>
      `
    });
    return true;
  } catch (error) {
    console.error('Contract email failed:', error.message);
    return false;
  }
};

module.exports = { sendResetPasswordEmail, sendWelcomeEmail, sendFriendRequestEmail };
