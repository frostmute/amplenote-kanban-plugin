const esbuild = require('esbuild');

esbuild.build({
  entryPoints: ['src/plugin.ts'],
  bundle: true,
  outfile: 'build/compiled.js',
  format: 'iife',
  globalName: 'plugin',
  minify: false,
  footer: {
    js: 'module.exports = plugin;'
  }
}).catch(() => process.exit(1));
