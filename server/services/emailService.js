const nodemailer = require('nodemailer');

/**
 * Professional Email Service using Brevo SMTP Relay.
 * Robust and stable to prevent server crashes.
 */
const transporter = nodemailer.createTransport({
  host: 'smtp-relay.brevo.com',
  port: 587,
  secure: false, // TLS
  auth: {
    user: 'waaleywaaleywaaley@gmail.com', // Your Brevo authorized login
    pass: process.env.BREVO_API_KEY,      // Your API key acts as the password
  },
});

const sendResetPasswordEmail = async (userEmail, resetUrl) => {
  try {
    const mailOptions = {
      from: '"HAKOWARE ASSOCIATION" <system@hakoware.vps>',
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
          <p style="font-size: 0.8rem; color: #71717a;">If you did not request this, please secure your account immediately. No action is required if you wish to maintain your current pin.</p>
        </div>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Recovery Email Dispatched: %s', info.messageId);
    return true;
  } catch (error) {
    console.error('Email Transmission Error:', error);
    return false;
  }
};

module.exports = { sendResetPasswordEmail };
