// models/User.js
const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  userId: {                     // Student ID / Driver ID / Admin ID (ADMIN01)
    type: String,
    required: true,
    unique: true
  },

  fullName: {
    type: String,
    required: true
  },

  passwordHash: {
    type: String,
    required: true
  },

  role: {
    type: String,
    enum: ["Student", "Driver", "Coordinator", "Admin"],
    default: "Student"
  },

  // ===== PROFILE FIELDS (ALL ROLES) =====
  phone: {
    type: String
  },

  email: {
    type: String
  },

  office: {
    type: String
  },

  emergencyContact: {
    type: String
  }

}, { timestamps: true });

module.exports = mongoose.model("User", userSchema);
