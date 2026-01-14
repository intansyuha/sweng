const express = require("express");
const bcrypt = require("bcryptjs");
const User = require("../models/User");

const router = express.Router();

// ===============================
// GET ALL USERS (ADMIN)
// ===============================
router.get("/users", async (req, res) => {
  try {
    const users = await User.find({}, "-passwordHash");
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: "Failed to load users" });
  }
});

// ===============================
// UPDATE USER (NAME + ROLE + PASSWORD)
// ===============================
router.put("/users/:userId", async (req, res) => {
  const { fullName, role, password } = req.body;

  try {
    const update = { fullName, role };

    if (password) {
      update.passwordHash = await bcrypt.hash(password, 10);
    }

    await User.updateOne(
      { userId: req.params.userId },
      update
    );

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: "Update failed" });
  }
});



// ===============================
// DELETE USER
// ===============================
router.delete("/users/:userId", async (req, res) => {
  const { userId } = req.params;

  // SAFETY: MAIN ADMIN CANNOT BE DELETED
  if (userId === "ADMIN01") {
    return res.status(403).json({ message: "Cannot delete main admin" });
  }

  try {
    await User.deleteOne({ userId });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: "Delete failed" });
  }
});
// ===============================
// GET SINGLE USER (ADMIN)
// ===============================
router.get("/users/:userId", async (req, res) => {
  try {
    const user = await User.findOne(
      { userId: req.params.userId },
      "-passwordHash"
    );

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json(user);
  } catch (err) {
    res.status(500).json({ message: "Failed to load user" });
  }
});

module.exports = router;
