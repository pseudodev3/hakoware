const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  pool: true,
  host: "smtp-relay.brevo.com",
  port: 465,
  secure: true, 
  auth: {
    user: "hakoware265@gmail.com",
    pass: process.env.BREVO_API_KEY,
  },
});

const sendResetPasswordEmail = async (userEmail, resetUrl) => {
  try {
    // Verify before sending
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
          <p style="font-size: 0.8rem; color: #71717a;">If you did not request this, please secure your account immediately. No action is required if you wish to maintain your current pin.</p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log(`Recovery link dispatched to ${userEmail}`);
    return true;
  } catch (error) {
    console.error('Brevo SMTP Failure:', error);
    throw error; // Throw so the route catch block can capture it
  }
};

module.exports = { sendResetPasswordEmail };
