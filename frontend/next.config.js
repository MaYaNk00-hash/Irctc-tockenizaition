/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:5000/api/:path*',
      },
      {
        source: '/waiting-room/:path*',
        destination: 'http://localhost:5000/waiting-room/:path*',
      },
      {
        source: '/booking/:path*',
        destination: 'http://localhost:5000/booking/:path*',
      },
      {
        source: '/health',
        destination: 'http://localhost:5000/health',
      },
    ];
  },
};

module.exports = nextConfig;

