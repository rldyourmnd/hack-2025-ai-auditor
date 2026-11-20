/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  trailingSlash: false,
  poweredByHeader: false,
  compress: true,
  images: {
    unoptimized: true
  }
}

module.exports = nextConfig
