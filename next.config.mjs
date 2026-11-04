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
            const manifestPath = path.join(serverDir, 'pages-manifest.json');
            try {
              if (!fs.existsSync(manifestPath)) {
                fs.mkdirSync(serverDir, { recursive: true });
                fs.writeFileSync(
                  manifestPath,
                  JSON.stringify(
                    {
                      '/_app': 'pages/_app.js',
                      '/_error': 'pages/_error.js',
                      '/_document': 'pages/_document.js',
                      '/404': 'pages/404.html',
                    },
                    null,
                    2
                  )
                );
              }
            } catch {
              // Silently continue if filesystem is read-only
            }
          });
        },
      });
    }
    return config;
  },
};

export default nextConfig;

