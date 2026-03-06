const nodemailer = require('nodemailer');

/**
 * Professional Email Service using Brevo SMTP Relay.
 * Credentials loaded securely from .env.
 */
const transporter = nodemailer.createTransport({
  pool: true,
  host: process.env.SMTP_HOST || 'smtp-relay.brevo.com',
  port: parseInt(process.env.SMTP_PORT) || 587,
  secure: false, // TLS
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.BREVO_API_KEY, // Your SMTP Master Password / Key
  },
});

const sendResetPasswordEmail = async (userEmail, resetUrl) => {
  try {
    await transporter.verify();
    const mailOptions = {
      from: '"HAKOWARE ASSOCIATION" <hakoware265@gmail.com>',
      to: userEmail,
      subject: '🔐 RECOVERY PROTOCOL: PASSWORD RESET REQUESTED',
      html: `
        <div style="background: #0a0a0b; color: #ffffff; padding: 40px; font-family: sans-serif; border: 1px solid #ffd700;">
          <h1 style="color: #ffd700; letter-spacing: 4px;">HAKOWARE ASSOCIATION</h1>
          <p style="font-size: 1.1rem;">A password recovery protocol has been initiated for your hunter account.</p>
          <hr style="border: 0; border-top: 1px solid #333; margin: 20px 0;" />
          <p style="color: #a1a1aa;">Click the button below to authorize a new security pin. This link will expire in 1 hour.</p>
          <div style="text-align: center; margin: 40px 0;">
            <a href="${resetUrl}" style="background: #ffd700; color: #000000; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px;">RESET PASSWORD</a>
          </div>
          <p style="font-size: 0.8rem; color: #71717a;">If you did not request this, please secure your account immediately.</p>
        </div>
      `,
    };
    const info = await transporter.sendMail(mailOptions);
    console.log(`Recovery link dispatched to ${userEmail}: ${info.messageId}`);
    return true;
  } catch (error) {
    console.error('Email Failure (Reset):', error);
    throw error;
  }
};

const sendWelcomeEmail = async (userEmail, userName) => {
  try {
    const mailOptions = {
      from: '"HAKOWARE ASSOCIATION" <hakoware265@gmail.com>',
      to: userEmail,
      subject: '📜 ASSOCIATION ENTRY: ENROLLMENT SUCCESSFUL',
      html: `
        <div style="background: #0a0a0b; color: #ffffff; padding: 40px; font-family: sans-serif; border: 1px solid #ffd700;">
          <h1 style="color: #ffd700; letter-spacing: 4px;">HAKOWARE ASSOCIATION</h1>
          <p style="font-size: 1.1rem;">Welcome to the Association, <strong>${userName}</strong>.</p>
          <hr style="border: 0; border-top: 1px solid #333; margin: 20px 0;" />
          <p style="color: #a1a1aa;">Your enrollment is confirmed. You are now authorized to track debts, initiate contracts, and earn Aura.</p>
          <div style="background: rgba(255,215,0,0.05); padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0; font-size: 0.8rem; color: #ffd700;">INITIAL STATUS</p>
            <p style="margin: 0; font-size: 1.2rem; font-weight: bold;">PROVISIONAL HUNTER</p>
          </div>
          <p style="font-size: 0.8rem; color: #71717a;">Proceed with caution. Every day of silence adds to the tally.</p>
        </div>
      `,
    };
    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error('Email Failure (Welcome):', error);
    return false;
  }
};

const sendFriendRequestEmail = async (toEmail, fromName) => {
  try {
    const mailOptions = {
      from: '"HAKOWARE ASSOCIATION" <hakoware265@gmail.com>',
      to: toEmail,
      subject: '⚔️ CONTRACT PENDING: NEW HUNTER CHALLENGE',
      html: `
        <div style="background: #0a0a0b; color: #ffffff; padding: 40px; font-family: sans-serif; border: 1px solid #00e5ff;">
          <h1 style="color: #00e5ff; letter-spacing: 4px;">HAKOWARE ASSOCIATION</h1>
          <p style="font-size: 1.1rem;"><strong>${fromName}</strong> has initiated a binding contract with you.</p>
          <hr style="border: 0; border-top: 1px solid #333; margin: 20px 0;" />
          <p style="color: #a1a1aa;">To authorize this contract and begin the Hakoware protocol, log in to your dashboard.</p>
          <div style="text-align: center; margin: 40px 0;">
            <a href="https://hakoware.vercel.app" style="background: #00e5ff; color: #000000; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px;">AUTHORIZE CONTRACT</a>
          </div>
        </div>
      `,
    };
    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error('Email Failure (Request):', error);
    return false;
  }
};

module.exports = { sendResetPasswordEmail, sendWelcomeEmail, sendFriendRequestEmail };
