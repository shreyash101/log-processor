const supabase = require("../supabaseClient");

async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized: Missing token" });
    }

    const token = authHeader.split(" ")[1];
    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data.user) {
      return res.status(401).json({ error: "Unauthorized: Invalid or expired token" });
    }

    req.user = data.user; // Attach user info to request
    next(); // Proceed to the route handler
  } catch (err) {
    res.status(500).json({ error: "Internal Server Error" });
  }
}

module.exports = authenticate;