// CommonJS runner: dynamically import the ESM migration module and invoke runMigration()
(async () => {
  try {
    const mod = await import('./migrate_enhanced_schema.js');
    if (mod && mod.runMigration) {
      await mod.runMigration();
      console.log('Runner: migration finished');
    } else if (mod && mod.default) {
      // some modules may export default
      await mod.default();
      console.log('Runner: migration finished (default export)');
    } else {
      console.error('Runner: migration module did not expose runMigration()');
      process.exit(2);
    }
  } catch (err) {
    console.error('Runner failed:', err && err.message ? err.message : err);
    process.exit(1);
  }
})();
