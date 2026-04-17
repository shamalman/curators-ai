/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async redirects() {
    return [
      {
        source: '/recommendations',
        destination: '/find',
        permanent: true,
      },
    ]
  },
}

module.exports = nextConfig
