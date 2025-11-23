// backend/routes/emailRoutes.js
const express = require("express");
const router = express.Router();
const Reminder = require("../models/reminder");
const { sendEmail } = require("../utils/emailService");

// 🔔 POST /api/emails/send-due-reminders
router.post("/send-due-reminders", async (req, res) => {
  try {
    // For demo: look up reminders that are unpaid,
    // have a user_email, and are due within the next N days.
    // If daysAhead not provided, default to 30 so your current
    // "blanket" reminder is included.
    const daysAhead =
      typeof req.body.daysAhead === "number" ? req.body.daysAhead : 30;

    const now = new Date();
    const startOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    );

    const targetDate = new Date(startOfToday);
    targetDate.setDate(startOfToday.getDate() + daysAhead);

    // ✅ For demo: only reminders that:
    //   - are unpaid
    //   - have user_email filled
    //   - due_date between today and targetDate
    const reminders = await Reminder.find({
      is_paid: false,
      user_email: { $exists: true, $ne: null },
      due_date: { $gte: startOfToday, $lte: targetDate },
    });

    console.log(
      `📨 Found ${reminders.length} due/overdue reminders in range [${startOfToday.toISOString()} - ${targetDate.toISOString()}]`
    );

    if (reminders.length === 0) {
      return res.json({ success: true, message: "No reminders due soon" });
    }

    let sentCount = 0;

    for (const reminder of reminders) {
      const email = reminder.user_email;

      if (!email) {
        console.warn(
          `⚠️ Reminder ${reminder._id.toString()} has no user_email; skipping`
        );
        continue;
      }

      const subject = `Reminder: ${reminder.bill_name} is due soon`;
      const text = `Hi! 👋

This is a reminder from Payble.

Your bill "${reminder.bill_name}" is due on ${new Date(
        reminder.due_date
      ).toLocaleDateString("en-IN", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })}.

Amount: ${
        reminder.amount != null ? `₹${reminder.amount}` : "Not specified"
      }.

Please pay before the due date to avoid penalties.

Thanks,
Team Payble`;

      try {
        await sendEmail(email, subject, text);
        console.log(
          `✅ Reminder email SENT to ${email} for bill "${reminder.bill_name}"`
        );
        sentCount++;
      } catch (e) {
        console.error(`❌ Failed to send email to ${email}`, e);
      }
    }

    return res.json({ success: true, sent: sentCount });
  } catch (err) {
    console.error("❌ Error sending due reminders:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
