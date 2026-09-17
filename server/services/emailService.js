const nodemailer = require('nodemailer');

const smtpPort = Number(process.env.SMTP_PORT) || 587;
const frontendUrl = (process.env.FRONTEND_URL || 'https://hakoware.vercel.app').replace(/\/$/, '');
const fromAddress = process.env.EMAIL_FROM || '"Hakoware" <hakoware265@gmail.com>';

const transporter = nodemailer.createTransport({
  pool: true,
  host: process.env.SMTP_HOST || 'smtp-relay.brevo.com',
  port: smtpPort,
  secure: smtpPort === 465,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS || process.env.BREVO_API_KEY
  }
});

const sendResetPasswordEmail = async (userEmail, resetUrl) => {
  try {
    await transporter.verify();
    const mailOptions = {
      from: fromAddress,
      to: userEmail,
      subject: '🔐 Hakoware password reset',
      html: `
        <div style="background:#0a0a0b;color:#fff;padding:40px;font-family:sans-serif;border:1px solid #e7b35a">
          <h1 style="color:#e7b35a;letter-spacing:3px">HAKOWARE</h1>
          <p>A password reset was requested for your Hakoware account.</p>
          <hr style="border:0;border-top:1px solid #333;margin:20px 0" />
          <p style="color:#a1a1aa">Use the button below to choose a new password. This link expires in one hour.</p>
          <div style="text-align:center;margin:40px 0">
            <a href="${resetUrl}" style="background:#e7b35a;color:#090907;padding:16px 32px;text-decoration:none;border-radius:10px;font-weight:700">RESET PASSWORD</a>
          </div>
          <p style="font-size:.8rem;color:#71717a">If you did not request this, you can ignore this email.</p>
        </div>
      `
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
    await transporter.sendMail({
      from: fromAddress,
      to: userEmail,
      subject: 'Welcome to Hakoware',
      html: `
        <div style="background:#0a0a0b;color:#fff;padding:40px;font-family:sans-serif;border:1px solid #e7b35a">
          <h1 style="color:#e7b35a;letter-spacing:3px">HAKOWARE</h1>
          <p>Welcome, <strong>${userName}</strong>.</p>
          <hr style="border:0;border-top:1px solid #333;margin:20px 0" />
          <p style="color:#a1a1aa">Your account is ready. Create a contract, check in with friends and build Aura.</p>
        </div>
      `
    });
    return true;
  } catch (error) {
    console.error('Email Failure (Welcome):', error);
    return false;
  }
};

const sendFriendRequestEmail = async (toEmail, fromName) => {
  try {
    await transporter.sendMail({
      from: fromAddress,
      to: toEmail,
      subject: 'New Hakoware contract request',
      html: `
        <div style="background:#0a0a0b;color:#fff;padding:40px;font-family:sans-serif;border:1px solid #e7b35a">
          <h1 style="color:#e7b35a;letter-spacing:3px">HAKOWARE</h1>
          <p><strong>${fromName}</strong> sent you a contract request.</p>
          <div style="text-align:center;margin:40px 0">
            <a href="${frontendUrl}" style="background:#e7b35a;color:#090907;padding:16px 32px;text-decoration:none;border-radius:10px;font-weight:700">OPEN HAKOWARE</a>
          </div>
        </div>
      `
    });
    return true;
  } catch (error) {
    console.error('Email Failure (Request):', error);
    return false;
  }
};

module.exports = { sendResetPasswordEmail, sendWelcomeEmail, sendFriendRequestEmail };
