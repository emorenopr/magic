const { getRedis } = require("../lib/redis");

const WINDOW_MS = 30000;

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const redis = getRedis();
  if (!redis) {
    res.status(200).json({ online: null });
    return;
  }

  const { sessionId } = req.body ?? {};
  if (typeof sessionId !== "string" || sessionId.length < 8 || sessionId.length > 100) {
    res.status(400).json({ error: "sessionId invalido" });
    return;
  }

  const now = Date.now();

  try {
    await redis.zadd("presence", { score: now, member: sessionId });
    await redis.zremrangebyscore("presence", 0, now - WINDOW_MS);
    const online = await redis.zcard("presence");
    res.status(200).json({ online });
  } catch (error) {
    console.error("Presence error:", error);
    res.status(200).json({ online: null });
  }
};
