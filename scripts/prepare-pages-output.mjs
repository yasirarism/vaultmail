import { cp, mkdir, rm, stat } from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const OPEN_NEXT_DIR = path.join(ROOT, '.open-next');
const OPEN_NEXT_ASSETS = path.join(OPEN_NEXT_DIR, 'assets');
const OPEN_NEXT_WORKER = path.join(OPEN_NEXT_DIR, 'worker.js');
const NOP_STATIC_DIR = path.join(ROOT, '.vercel', 'output', 'static');
const ALT_PAGES_OUTPUT = path.join(ROOT, '.cf-pages');

const exists = async (targetPath) => {
  try {
    await stat(targetPath);
    return true;
  } catch {
    return false;
  }
};

const prepareFromOpenNext = async (targetDir) => {
  await rm(targetDir, { recursive: true, force: true });
  await mkdir(targetDir, { recursive: true });

  await cp(OPEN_NEXT_DIR, targetDir, { recursive: true, dereference: true });
  await cp(OPEN_NEXT_ASSETS, targetDir, { recursive: true, dereference: true });
  await cp(OPEN_NEXT_WORKER, path.join(targetDir, '_worker.js'));
};

const prepareFromNextOnPages = async (targetDir) => {
  if (path.resolve(targetDir) === path.resolve(NOP_STATIC_DIR)) {
    return;
  }

  await rm(targetDir, { recursive: true, force: true });
  await mkdir(targetDir, { recursive: true });
  await cp(NOP_STATIC_DIR, targetDir, { recursive: true, dereference: true });
};

const main = async () => {
  if (process.env.SKIP_POSTBUILD_PREPARE === '1') {
    console.log('Skipped Pages output preparation: SKIP_POSTBUILD_PREPARE=1');
    return;
  }
  const hasOpenNext = await exists(OPEN_NEXT_WORKER);
  const hasNextOnPages = await exists(NOP_STATIC_DIR);

  if (hasOpenNext) {
    await prepareFromOpenNext(NOP_STATIC_DIR);
    await prepareFromOpenNext(ALT_PAGES_OUTPUT);
    console.log('Prepared Pages output (source: .open-next) at .vercel/output/static and .cf-pages');
    return;
  }

  if (hasNextOnPages) {
    await prepareFromNextOnPages(NOP_STATIC_DIR);
    await prepareFromNextOnPages(ALT_PAGES_OUTPUT);
    console.log('Prepared Pages output (source: .vercel/output/static) and synced .cf-pages');
    return;
  }

  console.log('Skipped Pages output preparation: no OpenNext or next-on-pages output found.');
};

main().catch((error) => {
  console.error('Failed to prepare Cloudflare Pages output:', error);
  process.exit(1);
});
