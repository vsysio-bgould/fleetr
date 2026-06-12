/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  headers: async () => [
    {
      source: "/(.*)",
      headers: [
        {
          key: "Content-Security-Policy",
          value: [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.youtube.com https://s.ytimg.com https://w.soundcloud.com", // Next.js requires unsafe-eval in dev
            "style-src 'self' 'unsafe-inline'",
            "img-src 'self' https://images.evetech.net https://web.ccpgamescdn.com https://i.ytimg.com https://img.youtube.com https://i1.sndcdn.com data:",
            "connect-src 'self' ws: wss: https://esi.evetech.net https://login.eveonline.com",
            "frame-src https://www.youtube.com https://www.youtube-nocookie.com https://w.soundcloud.com",
            "media-src 'self' https://www.youtube.com https://soundcloud.com https://*.sndcdn.com",
          ].join("; "),
        },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
      ],
    },
  ],

  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.evetech.net" },
      { protocol: "https", hostname: "web.ccpgamescdn.com" },
    ],
  },
};

export default nextConfig;
