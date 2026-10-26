const express = require("express");
const cors = require("cors");
const transactionRoutes = require("./routes/transaction.routes");
const dashboardRoutes = require("./routes/dashboard.routes");
const path = require('node:path');
function createApp({
  allowedOrigins = (process.env.CORS_ORIGINS || "http://localhost:5173,http://127.0.0.1:5173").split(",").map(origin => origin.trim()),
  frontendDir,
  desktopToken,
  runtime
} = {}) {
  const app = express();
  app.disable("x-powered-by");
  app.use(require('./middlewares/local-access.middleware').createLocalAccess(allowedOrigins));
  if (desktopToken) app.use((req, res, next) => {
    if (req.headers['x-desktop-capability'] !== desktopToken) return res.status(403).json({
      message: 'Instância desktop não autorizada.'
    });
    next();
  });
  if (runtime) app.use(runtime.middleware);
  app.use(cors({
    origin: allowedOrigins
  }));
  app.use(express.json({
    limit: "32kb"
  }));
  const prefix = frontendDir ? "/api" : "";
  app.use(prefix + "/planning", require("./routes/planning.routes"));
  app.use(prefix + "/market", require("./routes/market.routes"));
  app.use(prefix + "/finance", require("./routes/finance.routes"));
  app.use(prefix + "/transactions", transactionRoutes);
  app.use(prefix + "/dashboard", dashboardRoutes);
  if (frontendDir) {
    app.use(express.static(frontendDir, {
      index: false,
      setHeaders(res) {
        res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");
      }
    }));
    app.get(['/', '/dashboard'], (req, res) => {
      res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");
      res.sendFile(path.join(frontendDir, 'index.html'));
    });
  } else app.get('/', (req, res) => res.send('Servidor rodando!'));
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    if (error.type === "entity.parse.failed") return res.status(400).json({
      message: "JSON inválido."
    });
    if (error.type === "entity.too.large") return res.status(413).json({
      message: "Requisição muito grande."
    });
    if (error.status) return res.status(error.status).json({
      message: error.message
    });
    if ([5, 6].includes(error.errcode)) return res.status(503).json({
      message: 'Banco local em uso. Tente novamente.'
    });
    if (error.errcode === 2067 || error.errcode === 1555) return res.status(409).json({
      message: 'Registro já existente.'
    });
    if ([787, 275, 1299, 3091].includes(error.errcode)) return res.status(400).json({
      message: 'Dados incompatíveis com as regras financeiras.'
    });
    console.error("Erro de requisição:", error.code || "INTERNAL_ERROR");
    require('./services/diagnostics.cjs').log('HTTP_ERROR',error);
    res.status(500).json({
      message: "Erro interno do servidor."
    });
  });
  return app;
}
const app = createApp();
async function startLocalServer({
  port = Number(process.env.PORT || 3000),
  appOptions = {},
  runtime = require('./services/runtime.cjs').createServiceRuntime()
} = {}) {
  let server;
  let closing;
  const close = () => {
    if (closing) return closing;
    runtime.pause();
    closing = (async () => {
      await new Promise(resolve => {
        server.close(resolve);
        server.closeIdleConnections();
      });
      await runtime.stop();
    })();
    return closing;
  };
  try {
    runtime.initialize();
    server = require('node:http').createServer(createApp({
      ...appOptions,
      runtime
    }));
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(port, '127.0.0.1', resolve);
    });
    runtime.start();
    return {
      server,
      runtime,
      close
    };
  } catch (error) {
    if (server?.listening) await new Promise(resolve => {
      server.close(resolve);
      server.closeIdleConnections();
    });
    await runtime.stop();
    throw error;
  }
}
if (require.main === module) {
  startLocalServer().then(instance => {
    console.log(`Servidor na porta ${instance.server.address().port}`);
    const shutdown = () => instance.close().catch(error => {
      console.error('Falha no encerramento:', error.code || 'INTERNAL_ERROR');
      process.exitCode = 1;
    });
    process.once('SIGINT', shutdown);
    process.once('SIGTERM', shutdown);
  }).catch(error => {
    console.error('Falha ao iniciar serviços:', error.code || 'INTERNAL_ERROR');
    process.exitCode = 1;
  });
}
module.exports = app;
module.exports.createApp = createApp;
module.exports.startLocalServer = startLocalServer;
