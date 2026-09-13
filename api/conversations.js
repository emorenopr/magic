const { getRedis } = require("../lib/redis");
const { computeStats } = require("../lib/stats");

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) {
    res.status(503).json({ error: "ADMIN_PASSWORD no está configurado en el servidor." });
    return;
  }

  const { password } = req.body ?? {};
  if (password !== adminPassword) {
    res.status(401).json({ error: "Contraseña incorrecta." });
    return;
  }

  const redis = getRedis();
  if (!redis) {
    res.status(200).json({ conversations: [], stats: null });
    return;
  }

  try {
    const raw = await redis.lrange("chat_logs", 0, 499);
    const conversations = raw
      .map((entry) => {
        try {
          return typeof entry === "string" ? JSON.parse(entry) : entry;
        } catch {
          return null;
        }
      })
      .filter(Boolean);
    const stats = computeStats(conversations);
    res.status(200).json({ conversations: conversations.slice(0, 199), stats });
  } catch (error) {
    console.error("Conversations error:", error);
    res.status(502).json({ error: "No se pudieron cargar las conversaciones." });
  }
};
