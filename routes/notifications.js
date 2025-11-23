// backend/routes/notifications.js
const express = require("express");
const router = express.Router();
const Reminder = require("../models/reminder");

// GET /api/notifications
router.get("/", async (req, res) => {
  try {
    // 🧩 Get user id from Supabase-authenticated request
    const userId =
      req.user?.id ||
      req.user?.user_id ||
      req.user?.sub ||
      req.headers["x-user-id"]; // fallback for testing

    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    const now = new Date();
    const in3Days = new Date(now);
    in3Days.setDate(now.getDate() + 3);

    // 1️⃣ Unpaid + due/overdue/upcoming (same as earlier)
    const dueReminders = await Reminder.find({
      user_id: userId,
      is_paid: false,
      due_date: { $lte: in3Days },
    }).sort({ due_date: 1 });

    const dueNotifications = dueReminders.map((r) => {
      const diffMs = r.due_date.getTime() - now.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      let type;
      let message;

      if (diffDays < 0) {
        type = "overdue";
        message = `⚠️ ${r.bill_name} was due ${Math.abs(diffDays)} day(s) ago.`;
      } else if (diffDays === 0) {
        type = "due_today";
        message = `📅 ${r.bill_name} is due today.`;
      } else {
        type = "upcoming";
        message = `⏰ ${r.bill_name} is due in ${diffDays} day(s).`;
      }

      return {
        id: r._id,
        bill_name: r.bill_name,
        amount: r.amount,
        due_date: r.due_date,
        priority: r.priority,
        type,
        message,
      };
    });

    // 2️⃣ Payment success / failed notifications
    //    We pick reminders where payment_status was set by /api/payments/verify
    const paymentReminders = await Reminder.find({
      user_id: userId,
      payment_status: { $in: ["success", "failed"] },
    })
      .sort({ _id: -1 }) // newest first
      .limit(10); // avoid infinite list

    const paymentNotifications = paymentReminders.map((r) => {
      const isSuccess = r.payment_status === "success";

      return {
        id: r._id,
        bill_name: r.bill_name,
        amount: r.amount,
        due_date: r.due_date,
        priority: r.priority,
        type: isSuccess ? "payment_success" : "payment_failed",
        message: isSuccess
          ? `💰 Payment successful for ${r.bill_name}. Amount: ₹${r.amount ?? ""}.`
          : `❌ Payment failed for ${r.bill_name}. Please try again.`,
      };
    });

    // Combine: show latest payment notifications first, then due/reminder ones
    const notifications = [...paymentNotifications, ...dueNotifications];

    res.json({ notifications });
  } catch (err) {
    console.error("Error fetching notifications:", err);
    res.status(500).json({ error: "Failed to fetch notifications" });
  }
});

module.exports = router;
