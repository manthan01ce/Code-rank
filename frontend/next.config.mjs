/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  compress: true,
  reactStrictMode: true,
  allowedDevOrigins: [
    'localhost',
    '10.59.69.42',
    '192.168.137.1', 
    '172.16.105.4', 
    '172.24.32.1', 
    '0.0.0.0',
    '*.local',
    '*.lan'
  ],
};

export default nextConfig;
