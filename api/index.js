module.exports = function handler(req, res) {
  res.status(200).json({
    name: 'MAHJ MAHJ Content API',
    version: '1.0.0',
    endpoints: {
      events: '/api/events',
      news: '/api/news',
    },
    docs: 'https://github.com/luckyduck33/mahjmahj-api',
  });
};
