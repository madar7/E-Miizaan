// Escapes user input before it's used inside a MongoDB $regex, so search
// text like "a+b" or "(" can't be interpreted as regex syntax.
function escapeRegex(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
module.exports = { escapeRegex };
