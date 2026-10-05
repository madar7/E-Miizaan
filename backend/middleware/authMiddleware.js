const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { fail } = require("../utils/response");

async function protect(req, res, next) {
  let token;
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.split(" ")[1];
  }

  if (!token) {
    return fail(res, { status: 401, message: "Not authorized, no token provided" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (!user) {
      return fail(res, { status: 401, message: "Not authorized, user no longer exists" });
    }
    if (!user.isActive) {
      return fail(res, { status: 403, message: "This account has been deactivated. Contact the administrator." });
    }
    req.user = user;
    next();
  } catch (err) {
    return fail(res, { status: 401, message: "Not authorized, invalid or expired token" });
  }
}

function adminOnly(req, res, next) {
  if (!req.user || req.user.role !== "admin") {
    return fail(res, { status: 403, message: "Admin access required" });
  }
  next();
}

module.exports = { protect, adminOnly };
