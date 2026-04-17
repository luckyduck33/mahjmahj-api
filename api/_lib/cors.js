const ALLOWED_ORIGINS = [
  'https://mahjmahj.co',
  'https://www.mahjmahj.co',
  'https://app.mahjmahj.co',
];

function isAllowedOrigin(origin) {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  if (/^http:\/\/localhost(:\d+)?$/.test(origin)) return true;
  return false;
}

function setCorsHeaders(req, res) {
  const origin = req.headers.origin;
  if (isAllowedOrigin(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function setCacheHeaders(res) {
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
}

function handleCors(req, res) {
  setCorsHeaders(req, res);
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return true;
  }
  return false;
}

module.exports = { handleCors, setCacheHeaders };
