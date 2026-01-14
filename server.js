// =======================
// server.js (SECURE SETUP)
// =======================

const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const bcrypt = require("bcrypt");
const jwt = require('jsonwebtoken');

const User = require("./models/User");
const Route = require('./models/Route');
const Booking = require('./models/Booking');

const app = express();
const PORT = 3000;

// =======================
// CONFIGURATION
// =======================
const JWT_SECRET = "YOUR_SUPER_SECURE_SECRET_KEY_HERE";
const MONGODB_URI = "mongodb://localhost:27017/mmu_shuttle";

// =======================
// DATABASE CONNECTION
// =======================
mongoose.connect(MONGODB_URI)
    .then(() => console.log("MongoDB Connected Successfully!"))
    .catch(err => console.error("MongoDB Error:", err));

// ==============================
// AUTO-CREATE DEFAULT ADMIN
// ==============================
async function createDefaultAdmin() {
  try {
    const adminExists = await User.findOne({ userId: "ADMIN01" });

    if (adminExists) {
      console.log("ℹ️ Default admin already exists, skipping creation");
      return;
    }

    const hash = await bcrypt.hash("admin123", 10);

    await User.create({
      userId: "ADMIN01",
      fullName: "Nur Intan",
      passwordHash: hash,
      role: "Admin"
    });

    console.log("✅ Default Admin Created: ADMIN01 / admin123");

  } catch (err) {
    console.error("❌ Admin Creation Error:", err.message);
  }
}


// Run AFTER MongoDB connects
mongoose.connection.once("open", createDefaultAdmin);


// =======================
// MIDDLEWARE
// =======================
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
// ==============================
// ADMIN: CREATE DRIVER / COORDINATOR
// ==============================
app.post("/api/admin/create-user", async (req, res) => {
    const { name, userId, password, role } = req.body;

    if (!name || !userId || !password || !role) {
        return res.status(400).json({
            success: false,
            message: "All fields are required"
        });
    }

    if (!["Driver", "Coordinator"].includes(role)) {
        return res.status(400).json({
            success: false,
            message: "Invalid role"
        });
    }

    try {
        const exists = await User.findOne({ userId });
        if (exists) {
            return res.status(400).json({
                success: false,
                message: "User ID already exists"
            });
        }

        const hash = await bcrypt.hash(password, 10);

        const newUser = new User({
            userId,
            fullName: name,
            passwordHash: hash,
            role
        });

        await newUser.save();

        res.json({
            success: true,
            message: `${role} account created successfully`
        });

    } catch (err) {
        console.error("Admin Create User Error:", err);
        res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
});


app.delete("/api/routes/:id", async (req, res) => {
  try {
    await Route.deleteOne({ routeId: req.params.id });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});
app.put("/api/routes/:id", async (req, res) => {
  const { from, to, departure, driverId } = req.body;

  try {
    await Route.updateOne(
      { routeId: req.params.id },
      {
        from,
        to,
        departureTime: departure,
        driverAssigned: driverId
      }
    );

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});
// ==============================
// AUTH: USER REGISTRATION
// ==============================
app.post("/api/register", async (req, res) => {
    const { name, userId, password } = req.body;

    if (!name || !userId || !password) {
        return res.status(400).json({ success: false, message: "Missing fields" });
    }

    try {
        const exists = await User.findOne({ userId });
        if (exists) {
            return res.status(400).json({ success: false, message: "User ID already exists" });
        }

        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);

        const newUser = new User({
            userId,
            fullName: name,
            passwordHash,
            role: "Student"
        });

        await newUser.save();

        res.json({ success: true, message: "Student registered successfully" });

    } catch (error) {
        console.error("Register Error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
});


// ==============================
// AUTH: LOGIN
// ==============================
app.post("/api/login", async (req, res) => {
    const { userId, password } = req.body;

    try {
        // FIX: Search case-insensitively using a regular expression
         const user = await User.findOne({ userId: { $regex: new RegExp("^" + userId + "$", "i") } });
        if (!user) {
            return res.status(401).json({ success: false, message: "Invalid ID or password" });
        }

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) {
            return res.status(401).json({ success: false, message: "Invalid ID or password" });
        }

        const token = jwt.sign(
            { id: user._id, userId: user.userId, role: user.role },
            JWT_SECRET,
            { expiresIn: "1h" }
        );

        res.json({
  success: true,
  token,
  role: user.role,
  userId: user.userId   // ✅ THIS LINE IS THE FIX
});


    } catch (error) {
        console.error("Login Error:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
});
// ==============================
// ROUTES API (MMU Shuttle)
// ==============================
// ================================
// GET ALL DRIVERS (FOR COORDINATOR)
// ================================
app.get("/api/drivers", async (req, res) => {
  try {
    const drivers = await User.find(
      { role: "Driver" },
      { userId: 1, fullName: 1, _id: 0 }
    );

    res.json(
      drivers.map(d => ({
        userId: d.userId,
        name: d.fullName
      }))
    );
  } catch (err) {
    res.status(500).json({ message: "Failed to load drivers" });
  }
});



// ==============================
// USER LIST (SAFE)
// ==============================
app.get("/api/users", async (req, res) => {
    try {
        const users = await User.find({});

        const clean = users.map(u => {
            const { passwordHash, ...rest } = u.toObject();
            return rest;
        });

        res.json(clean);

    } catch (error) {
        res.status(500).json({ message: "Failed to load users" });
    }
});

app.get("/api/routes", async (req, res) => {
    try {
        const routes = await Route.find({});

        if (routes.length === 0) {
            return res.json([]);
        }

      res.json(routes.map(r => ({
  id: r.routeId,
  from: r.from,
  to: r.to,
  departure: r.departureTime,
  driver: r.driverAssigned
})));


    } catch (error) {
        console.error("Route Error:", error);
        res.status(500).json({ message: "Failed to load shuttle routes" });
    }
});

// ==============================
// DRIVER: GET MY ASSIGNED ROUTE
// ==============================
app.get("/api/driver/my-route/:driverId", async (req, res) => {
  try {
    const route = await Route.findOne({
      driverAssigned: req.params.driverId
    });

    if (!route) {
      return res.json(null);
    }

    res.json({
      routeId: route.routeId,
      from: route.from,
      to: route.to,
      departure: route.departureTime
    });

  } catch (err) {
    res.status(500).json({ message: "Failed to load route" });
  }
});

// ==============================
// BOOKINGS API (Create Booking)
// ==============================
app.post("/api/bookings", async (req, res) => {
    const { studentId, routeId, time } = req.body;

    try {
        // Find route details
        const route = await Route.findOne({ routeId });
        if (!route) {
            return res.status(400).json({ success: false, message: "Invalid route selected." });
        }

        // Capacity check (Counts existing confirmed bookings)
        const currentBookings = await Booking.countDocuments({ routeId, time, status: 'Confirmed' });
        if (currentBookings >= route.capacity) {
            return res.status(400).json({ success: false, message: "No seats left for this time." });
        }

        // Create and save the new booking
        const newBooking = new Booking({
            studentId,
            routeId,
            time
        });
        await newBooking.save();

        res.json({ success: true, message: "Booking confirmed!", booking: newBooking });

    } catch (error) {
        console.error("Booking Creation Error:", error);
        res.status(500).json({ success: false, message: "Server error during booking." });
    }
});
// ==============================
// COORDINATOR: CREATE ROUTE
// ==============================
app.post("/api/routes", async (req, res) => {
  const { from, to, departure, driverId } = req.body;

  if (!from || !to || !departure || !driverId) {
    return res.status(400).json({
      success: false,
      message: "All fields are required"
    });
  }

  try {
    const newRoute = new Route({
      routeId: `R${Date.now()}`, // auto-generated
      from,
      to,
      departureTime: departure,
      driverAssigned: driverId
    });

    await newRoute.save();

    res.json({
      success: true,
      message: "Route created successfully"
    });

  } catch (err) {
    console.error("Create Route Error:", err);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
});
// ==============================
// ADMIN PROFILE - GET
// ==============================
app.get("/api/admin/profile/:userId", async (req, res) => {
  try {
    const user = await User.findOne({ userId: req.params.userId });

    if (!user || user.role !== "Admin") {
      return res.status(404).json({ message: "Admin not found" });
    }

    res.json({
      fullName: user.fullName || "",
      phone: user.phone || "",
      email: user.email || "",
      office: user.office || "",
      emergencyContact: user.emergencyContact || ""
    });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});
app.get("/api/admin/users", async (req, res) => {
  try {
    const users = await User.find({}, "-passwordHash");
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: "Failed to load users" });
  }
});
// ==============================
// ADMIN: GET SINGLE USER
// ==============================
app.get("/api/admin/users/:userId", async (req, res) => {
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

app.put("/api/admin/users/:userId", async (req, res) => {
  const { fullName, role } = req.body;

  try {
    await User.findOneAndUpdate(
      { userId: req.params.userId },
      { fullName, role }
    );

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: "Update failed" });
  }
});
app.put("/api/admin/users/:userId/password", async (req, res) => {
  const { password } = req.body;

  try {
    const hash = await bcrypt.hash(password, 10);
    await User.findOneAndUpdate(
      { userId: req.params.userId },
      { passwordHash: hash }
    );

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: "Password reset failed" });
  }
});
app.delete("/api/admin/users/:userId", async (req, res) => {
  try {
    await User.findOneAndDelete({ userId: req.params.userId });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: "Delete failed" });
  }
});

// ==============================
// ADMIN PROFILE - UPDATE
// ==============================
app.put("/api/admin/profile/:userId", async (req, res) => {
  const { fullName, phone, email, office, emergencyContact } = req.body;

  try {
    await User.updateOne(
      { userId: req.params.userId, role: "Admin" },
      { fullName, phone, email, office, emergencyContact }
    );

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

// =======================
// START SERVER
// =======================
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
