/** @type {import('next').NextConfig} */
const nextConfig = {
  reactCompiler: true,
  
  // Bas firebase-admin ko bahar rakhna kaafi hai v11.11.1 ke liye
  serverExternalPackages: ['firebase-admin'],
};

export default nextConfig;