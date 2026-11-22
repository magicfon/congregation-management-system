/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    outputFileTracingIncludes: {
      '/api/line-bot/rich-menu': ['./public/line/rich-menu-*.png'],
      '/api/line-bot/webhook': ['./docs/line-agent-knowledge/*.md'],
    },
  },
}

module.exports = nextConfig
