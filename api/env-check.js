export default async function handler(req, res) {
  const out = {
    has_URL: !!process.env.UPSTASH_REDIS_REST_URL,
    has_TOKEN: !!process.env.UPSTASH_REDIS_REST_TOKEN,
    node_env: process.env.NODE_ENV || null,
  };
  res.status(200).json(out);
}
