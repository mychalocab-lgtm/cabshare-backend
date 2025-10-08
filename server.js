// server.js
// ✅ Works locally & on Railway

require("dotenv").config();
const express = require("express");
const cors = require("cors");

const app = express();

// Enhanced CORS middleware for dynamic frontend IPs
const allowedOriginRegex = /^(http:\/\/(localhost|127\.0\.0\.1|192\.168\.[0-9]{1,3}\.[0-9]{1,3}|10\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}):\d{1,5})$/;
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    // Allow local IPs and localhost
    if (allowedOriginRegex.test(origin)) return callback(null, true);
    // In development, allow all origins
    if (process.env.NODE_ENV !== 'production') return callback(null, true);
    // Otherwise, block
    return callback(new Error('Not allowed by CORS: ' + origin));
  },
  credentials: true
}));
app.use(express.json());

// Import enhanced auth middleware
const {
  unifiedAuthMiddleware
} = require("./middleware/unifiedAuth");

// Add debug middleware in development
if (process.env.NODE_ENV === "development") {
  // app.use(debugAuthMiddleware); // Removed: not defined
}

// Minimal logging
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

// ✅ Root health endpoint (for Railway)
app.get("/", (req, res) => {
  res.send("🚖 Chalocab backend running successfully!");
});

// Detailed healthcheck
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    auth_middleware: "enhanced",
    environment: process.env.NODE_ENV || "production",
  });
});

// Import routes
const authRouter = require("./routes/auth.routes");
const newAuthRouter = require("./routes/auth");
const profileRouter = require("./routes/profile.routes");  // FIXED: Use new profile router with unified auth
const userManagementRouter = require("./routes/userManagement.routes");
const ridesRouter = require("./routes/rides.routes");
const bookingsRouter = require("./routes/bookings.routes");
const citiesRouter = require("./routes/cities.routes");
const routesRouter = require("./routes/routes.routes");
const profilesRouter = require("./routes/profiles.routes");
const messagesRouter = require("./routes/messages.routes");
const inboxRouter = require("./routes/inbox.routes");
const adminRoutes = require("./routes/admin");
const vehicleRoutes = require("./routes/vehicle.routes");
const debugRidesRouter = require("./routes/debug-rides");

// API Routes
app.use("/auth", authRouter);
app.use("/user-management", userManagementRouter);
app.use("/cities", citiesRouter);
app.use("/routes", routesRouter);
app.use("/profiles", profilesRouter); // Public access, no auth middleware
app.use("/rides", ridesRouter); // Public access, no auth middleware
app.use("/bookings", bookingsRouter);
app.use("/messages", unifiedAuthMiddleware, messagesRouter);
app.use("/inbox", unifiedAuthMiddleware, inboxRouter);

// API prefix routes
app.use("/api/auth", newAuthRouter);
app.use("/api/user-management", userManagementRouter);
app.use("/api/wallet", require("./routes/wallet"));
app.use("/api/profile", profileRouter);  // Main profile routes (includes vehicles via vehicleRoutes internally)
app.use("/api/rides", ridesRouter);
app.use("/api/bookings", bookingsRouter);
app.use("/api/cities", citiesRouter);
app.use("/api/routes", routesRouter);
app.use("/api/inbox", unifiedAuthMiddleware, inboxRouter);
app.use("/api/test", require("./routes/test.routes"));
app.use("/api/admin", adminRoutes);
app.use("/api/debug-rides", debugRidesRouter);

// Error handler
app.use((error, req, res, next) => {
  console.error("💥 Server Error:", error.message);
  res.status(500).json({
    error: "Internal server error",
    message: process.env.NODE_ENV === "development" ? error.message : undefined,
    timestamp: new Date().toISOString(),
  });
});

// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({
    error: "Route not found",
    path: req.originalUrl,
    method: req.method,
    timestamp: new Date().toISOString(),
  });
});

// Start server - Listen on all network interfaces (0.0.0.0)
const PORT = process.env.PORT || 3000;
const isProduction = process.env.NODE_ENV === 'production';

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Chalocab backend running on port ${PORT}`);
  
  if (isProduction) {
    console.log(`🌐 Environment: Production`);
    console.log(`🔐 Auth Mode: Production Mode`);
  } else {
    console.log(`🌐 Accessible at http://192.168.1.37:${PORT} (local network)`);
    console.log(`🔐 Auth Mode: Development Mode`);
  }
  
  console.log(`💚 Health: http://localhost:${PORT}/health`);
  console.log(`🌍 Root: http://localhost:${PORT}/`);
});

module.exports = app;
