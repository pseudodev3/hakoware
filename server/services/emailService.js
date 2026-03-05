const nodemailer = require('nodemailer');

// Configure this with your actual SMTP details in .env
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.example.com',
  port: process.env.SMTP_PORT || 587,
  secure: false, 
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const sendBankruptcyEmail = async (userEmail, userName, debtAmount) => {
  try {
    const mailOptions = {
      from: '"HAKOWARE ASSOCIATION" <system@hakoware.vps>',
      to: userEmail,
      subject: '⚠️ PROTOCOL ALERT: CHAPTER 7 BANKRUPTCY DECLARED',
      html: `
        <div style="background: #0a0a0b; color: #ffffff; padding: 40px; font-family: sans-serif; border: 1px solid #ff4444;">
          <h1 style="color: #ff4444; letter-spacing: 4px;">HAKOWARE ASSOCIATION</h1>
          <p style="font-size: 1.1rem;">Contract identification confirmed for <strong>${userName}</strong>.</p>
          <hr style="border: 0; border-top: 1px solid #333; margin: 20px 0;" />
          <p style="color: #a1a1aa;">The system has detected that your debt has exceeded the allowed grace period.</p>
          <div style="background: rgba(255,68,68,0.1); padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0; font-size: 0.8rem; color: #ff8888;">TOTAL ACCUMULATED DEBT</p>
            <p style="margin: 0; font-size: 2.5rem; font-weight: bold; color: #ff4444;">${debtAmount} APR</p>
          </div>
          <p style="font-weight: bold;">CONSEQUENCES INITIATED:</p>
          <ul>
            <li>Nen Abilities: SEALED (Zetsu Mode)</li>
            <li>Market Access: REVOKED</li>
            <li>Blacklist Status: ACTIVE (Wall of Shame)</li>
          </ul>
          <p style="margin-top: 40px; font-size: 0.8rem; color: #71717a;">Please perform a Voice Check-in or use a PURIFY card to restore system status.</p>
        </div>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Bankruptcy Email Sent: %s', info.messageId);
    return true;
  } catch (error) {
    console.error('Email Transmission Failed:', error);
    return false;
  }
};

module.exports = { sendBankruptcyEmail };
