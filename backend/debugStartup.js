process.on('exit', code => console.error('EXITING', code));
process.on('uncaughtException', err => { console.error('UNCAUGHT_EXCEPTION', err.stack); process.exit(1); });
process.on('unhandledRejection', reason => { console.error('UNHANDLED_REJECTION', reason); process.exit(1); });
try {
  require('./server.js');
  console.error('REQUIRE_COMPLETE');
} catch (e) {
  console.error('REQUIRE_FAIL', e.stack);
  process.exit(1);
}
