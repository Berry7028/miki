import { spawn } from 'node:child_process';
import { build } from 'esbuild';

const pages = [
  {
    entry: './renderer/pages/dashboard/index.tsx',
    outfile: './renderer/dist/index.js'
  },
  {
    entry: './renderer/pages/chat/index.tsx',
    outfile: './renderer/dist/chat.js'
  },
  {
    entry: './renderer/pages/overlay/index.tsx',
    outfile: './renderer/dist/overlay.js'
  }
];

let electronProcess = null;

function buildRenderer() {
  return Promise.all(
    pages.map(page =>
      build({
        entryPoints: [page.entry],
        outfile: page.outfile,
        target: 'browser',
        minify: false,
        watch: false,
        bundle: true,
        sourcemap: true,
        format: 'iife'
      })
    )
  );
}

function startElectron() {
  if (electronProcess) {
    return;
  }

  electronProcess = spawn('bun', ['run', 'dev'], {
    stdio: 'inherit',
    shell: true
  });

  electronProcess.on('exit', () => {
    electronProcess = null;
    process.exit(0);
  });
}

async function watchRenderer() {
  console.log('🔍 Watching renderer files for changes...\n');

  await buildRenderer();
  startElectron();

  for (const page of pages) {
    const ctx = await build({
      entryPoints: [page.entry],
      outfile: page.outfile,
      target: 'browser',
      minify: false,
      watch: {
        onRebuild(error, result) {
          if (error) {
            console.error(`❌ Build failed for ${page.outfile}:`, error);
          } else {
            console.log(`✅ Rebuilt ${page.outfile}`);
          }
        }
      },
      bundle: true,
      sourcemap: true,
      format: 'iife'
    });

    ctx.watch();
  }
}

watchRenderer().catch(err => {
  console.error('Error starting dev:ui mode:', err);
  process.exit(1);
});
