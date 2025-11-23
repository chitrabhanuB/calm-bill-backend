// backend/utils/emailService.js
const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: true, // Important for Gmail (port 465)
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

async function sendEmail(to, subject, text) {
  try {
    const info = await transporter.sendMail({
      from: `"Payble Notifications" <${process.env.SMTP_USER}>`,
      to,
      subject,
      text,
    });

    console.log("📧 SMTP Email sent:", info.messageId);
    return info;
  } catch (error) {
    console.error("❌ SMTP Error:", error);
    throw error;
  }
}

module.exports = { sendEmail };
