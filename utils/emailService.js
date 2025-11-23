// backend/utils/emailService.js
const { Resend } = require("resend");

const resend = new Resend(process.env.RESEND_API_KEY);

async function sendEmail(to, subject, text) {
  try {
    // Convert plain text to HTML
    const html = text.replace(/\n/g, "<br>");

    const result = await resend.emails.send({
      from: "Payble Notifications <onboarding@resend.dev>",
      to,
      subject,
      html,
    });

    console.log(`📧 Resend email sent to ${to}`);
    return result;
  } catch (error) {
    console.error("❌ Resend API error:", error);
    throw error;
  }
}

module.exports = { sendEmail };
