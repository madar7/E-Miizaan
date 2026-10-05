const rateLimit = require("express-rate-limit");
const { fail } = require("../utils/response");

// Slows down brute-force attempts against auth endpoints without affecting
// normal use. Keyed by IP; tune the numbers via env if needed later.
function authLimiter() {
  return rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20, // 20 attempts per IP per window across login/register/forgot-password
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => fail(res, { status: 429, message: "Too many attempts. Please try again in a few minutes." }),
  });
}

module.exports = { authLimiter };
