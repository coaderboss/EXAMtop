/** @type {import('next').NextConfig} */
const nextConfig = {
  reactCompiler: true,
  
  // 🔥 THE ULTIMATE FIX: Block firebase-admin AND its inner ESM dependencies
  serverExternalPackages: ['firebase-admin', 'jose', 'jwks-rsa'],
};

export default nextConfig;