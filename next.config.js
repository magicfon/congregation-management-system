/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    outputFileTracingIncludes: {
      '/api/line-bot/rich-menu': ['./public/line/rich-menu-v1.png'],
    },
  },
}

module.exports = nextConfig
