// backend/models/reminder.js
const mongoose = require("mongoose");

const reminderSchema = new mongoose.Schema({
  user_id: { type: String, required: true },

  // ✅ NEW: store the user's email for cron emails
  user_email: { type: String, required: false },

  bill_name: { type: String, required: true },
  amount: { type: Number, default: null },
  due_date: { type: Date, required: true },
  priority: {
    type: String,
    enum: ["low", "medium", "high"],
    default: "medium",
  },
  frequency: {
    type: String,
    enum: ["one-time", "monthly", "quarterly", "yearly"],
    default: "monthly",
  },
  is_paid: { type: Boolean, default: false },
  paid_at: { type: Date, default: null },

  // track last payment status (success / failed)
  payment_status: {
    type: String,
    enum: ["success", "failed", null],
    default: null,
  },
});

module.exports = mongoose.model("Reminder", reminderSchema);
