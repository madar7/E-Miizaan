// The Express app itself, with no server started — kept separate from
// server.js so tests can import it and attach their own ephemeral listener
// instead of binding to the real PORT.
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const mongoSanitize = require("express-mongo-sanitize");
const { fail } = require("./utils/response");
const { authLimiter } = require("./middleware/rateLimiters");

const authRoutes = require("./routes/authRoutes");
const transactionRoutes = require("./routes/transactionRoutes");
const adminRoutes = require("./routes/adminRoutes");
const categoryRoutes = require("./routes/categoryRoutes");
const reportRoutes = require("./routes/reportRoutes");
const profileRoutes = require("./routes/profileRoutes");
const businessRoutes = require("./routes/businessRoutes");
const userManagementRoutes = require("./routes/userManagementRoutes");

const app = express();
const isProd = process.env.NODE_ENV === "production";

// Security headers. Disabled CSP here because this API serves no HTML of its
// own — the frontend is a separate app with its own CSP concerns.
app.use(helmet({ contentSecurityPolicy: false }));

// Allows the separately-hosted frontend to call this API. Restrict via
// FRONTEND_ORIGIN in .env once you know the frontend's real URL in production.
const allowedOrigin = process.env.FRONTEND_ORIGIN;
app.use(cors(allowedOrigin ? { origin: allowedOrigin } : {}));

// 3mb (not the default 100kb) because profile/business images are uploaded as
// base64 data URLs in the JSON body — a 2MB image is ~2.7MB once base64-encoded.
app.use(express.json({ limit: "3mb" }));

// Strips any request key starting with "$" or containing "." (MongoDB
// operator injection via req.body/req.query/req.params).
app.use(mongoSanitize());

// Slows brute-force attempts against login/register/forgot-password. Skipped
// entirely in tests so the suite isn't rate-limited by its own volume of requests.
if (process.env.NODE_ENV !== "test") {
  app.use("/api/auth/login", authLimiter());
  app.use("/api/auth/register", authLimiter());
  app.use("/api/auth/forgot-password", authLimiter());
}

// API routes — this server serves no frontend files; the frontend is a separate app.
app.use("/api/auth", authRoutes);
app.use("/api/transactions", transactionRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/business", businessRoutes);
app.use("/api/users", userManagementRoutes);
app.use("/api/admin", adminRoutes);

app.get("/api/health", (req, res) => {
  res.json({ success: true, message: "E-Miizaan API is running", data: null });
});

app.get("/", (req, res) => {
  res.json({ success: true, message: "E-Miizaan API is running. The frontend is a separate app — see /frontend.", data: null });
});

// Unknown route
app.use((req, res) => {
  fail(res, { status: 404, message: "Route not found" });
});

// Central error handler — every unhandled error in the app ends up here via
// asyncHandler. Stack traces and raw driver errors never reach the client in
// production; they're always logged server-side either way.
app.use((err, req, res, next) => {
  console.error(err);

  if (err.name === "ValidationError") {
    return fail(res, { status: 400, message: Object.values(err.errors).map((e) => e.message).join(", ") });
  }
  if (err.name === "CastError") {
    return fail(res, { status: 400, message: "Invalid ID format" });
  }
  if (err.code === 11000) {
    return fail(res, { status: 409, message: "A record with that value already exists" });
  }

  return fail(res, {
    status: err.status || 500,
    message: isProd ? "Something went wrong" : err.message,
  });
});

module.exports = app;
