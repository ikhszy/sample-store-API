import 'dotenv/config';
import app from './app.js';
import db from './db/client.js';

// Run schema setup on first boot so a fresh clone works with just `npm run dev`
import './db/schema.js';

const PORT = process.env.PORT || 3001;

const server = app.listen(PORT, () => {
  console.log(`\n🚀  Server running at http://localhost:${PORT}`);
  console.log(`   Environment : ${process.env.NODE_ENV || 'development'}`);
  console.log(`   Database    : ${db.name}`);
  console.log(`\n   Endpoints:`);
  console.log(`     GET  /health`);
  console.log(`     POST /auth/register`);
  console.log(`     POST /auth/login`);
  console.log(`     POST /auth/refresh`);
  console.log(`     POST /auth/logout`);
  console.log(`     GET  /auth/me`);
  console.log(`     GET  /products`);
  console.log(`     GET  /cart`);
  console.log(`     GET  /orders\n`);
});

// Graceful shutdown
function shutdown(signal) {
  console.log(`\n${signal} received — shutting down gracefully.`);
  server.close(() => {
    db.close();
    console.log('Server and database closed.');
    process.exit(0);
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));
