import fs from 'node:fs';
import path from 'node:path';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
  experimental: {
    webpackBuildWorker: false,
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
  webpack: (config, { isServer, dev }) => {
    if (isServer && !dev) {
      config.plugins.push({
        apply: (compiler) => {
          compiler.hooks.afterEmit.tap('EnsurePagesManifestPlugin', () => {
            const serverDir = path.isAbsolute(compiler.outputPath)
              ? compiler.outputPath
              : path.resolve(process.cwd(), compiler.outputPath);
            const canonicalServerDir = path.resolve(process.cwd(), '.next', 'server');
            const targetDirs = Array.from(new Set([serverDir, canonicalServerDir]));
            const fallbackManifest = JSON.stringify(
              {
                '/_app': 'pages/_app.js',
                '/_error': 'pages/_error.js',
                '/_document': 'pages/_document.js',
                '/404': 'pages/404.html',
              },
              null,
              2
            );

            for (const dir of targetDirs) {
              const manifestPath = path.join(dir, 'pages-manifest.json');
              try {
                let needsWrite = false;
                if (!fs.existsSync(manifestPath)) {
                  needsWrite = true;
                } else {
                  try {
                    const content = fs.readFileSync(manifestPath, 'utf8').trim();
                    if (!content || content.length === 0) {
                      needsWrite = true;
                    } else {
                      JSON.parse(content);
                    }
                  } catch {
                    needsWrite = true;
                  }
                }

                if (needsWrite) {
                  fs.mkdirSync(dir, { recursive: true });
                  fs.writeFileSync(manifestPath, fallbackManifest, 'utf8');
                }
              } catch {
                // Silently continue if filesystem is read-only
              }
            }
          });
        },
      });
    }
    return config;
  },
};

export default nextConfig;

