const loopback = address => ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(address);
function createLocalAccess(origins) {
  const allowed = new Set(origins);
  for (const origin of allowed) {
    const url = new URL(origin);
    if (!['http:', 'https:'].includes(url.protocol) || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) || url.origin !== origin) throw new Error('CORS_ORIGINS deve conter somente origens locais explícitas.');
  }
  return (req, res, next) => {
    if (!loopback(req.socket.remoteAddress)) return res.status(403).json({
      message: 'Acesso restrito ao computador local.'
    });
    const host = req.headers.host;
    if (!host || !/^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i.test(host)) return res.status(403).json({
      message: 'Host não permitido.'
    });
    const origin = req.headers.origin;
    if (origin && !allowed.has(origin)) return res.status(403).json({
      message: 'Origem não permitida.'
    });
    if (req.headers['sec-fetch-site'] === 'cross-site') return res.status(403).json({
      message: 'Requisição externa bloqueada.'
    });
    if (['POST', 'PUT', 'PATCH'].includes(req.method) && !req.is('application/json')) return res.status(415).json({
      message: 'Envie application/json.'
    });
    next();
  };
}
module.exports = {
  createLocalAccess
};
