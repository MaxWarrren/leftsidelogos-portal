import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * @type {import('next').NextConfig}
 *
 * This repo keeps two apps (Portal/ and Website/) under one parent folder, each
 * with its own lockfile. Next 16 / Turbopack would otherwise infer the shared
 * parent as the workspace root and intermittently resolve node_modules from
 * there (where nothing is installed), causing flaky "Can't resolve 'sonner' /
 * 'tailwindcss'" errors in dev. Pinning the root to this directory fixes it.
 */
const nextConfig = {
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
