/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    outputFileTracingIncludes: {
      '/api/line-bot/rich-menu': ['./public/line/rich-menu-*.png'],
    },
  },
}

module.exports = nextConfig
