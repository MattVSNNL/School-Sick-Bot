import crypto from "node:crypto";

function safeEqual(left, right) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function requireApiKey(expected) {
  return (req, res, next) => {
    const header = req.get("authorization") ?? "";
    const supplied = header.startsWith("Bearer ") ? header.slice(7) : "";
    if (!supplied || !safeEqual(supplied, expected)) {
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    }
    next();
  };
}
