/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */
  reactCompiler: true,
  
  //Firebase admin ko bundle hone se rokne ke liye
  serverExternalPackages: ['firebase-admin'],
};

export default nextConfig;