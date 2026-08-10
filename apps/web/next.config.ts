import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
    transpilePackages: ["@workspace/ui", "@repo/database"],
    async rewrites() {
        return [
            {
                source: '/ormify-uploads/:path*',
                destination: 'http://localhost:5001/ormify-uploads/:path*'
            }
        ];
    },
    images: {
        remotePatterns: [
            { protocol: "https", hostname: "images.unsplash.com", pathname: "/**" },
            { protocol: "https", hostname: "lh3.googleusercontent.com", pathname: "/**" },
            { protocol: "https", hostname: "kukushop-s3-bucket.s3.eu-north-1.amazonaws.com", pathname: "/**" },
            { protocol: "https", hostname: "*.s3.*.amazonaws.com", pathname: "/**" },
            { protocol: "https", hostname: "utfs.io", pathname: "/**" },
            { protocol: "https", hostname: "zw7cbqgf42.ufs.sh", pathname: "/**" },
            { protocol: "https", hostname: "jtpad21u0s.ufs.sh", pathname: "/**" },
            { protocol: "https", hostname: "0xju7y00ag.ufs.sh", pathname: "/**" },
            { protocol: "https", hostname: "aceternity.com", pathname: "/**" },
            { protocol: "https", hostname: "source.unsplash.com", pathname: "/**" },
        ],
    },
    turbopack: {},
}

export default nextConfig