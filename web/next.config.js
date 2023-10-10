/** @type {import('next').NextConfig} */
const nextConfig = {
  // Blobs within feeds have URLs relative to their own feed.
  // To resolve the blob we need both the blob and feed key.
  // So when on a feed's page we want to keep the trailing slash, so the base of the relative URL contains the feed's key.
  trailingSlash: true,

  async rewrites () {
    return [
      {
        source: '/feed/:feed([A-Za-z0-9\-\_]{43,})/:blob([A-Za-z0-9\-\_]{43,}\.[A-Za-z0-9]+)',
        destination: 'http://localhost:8080/:feed/:blob',
      },
    ];
  },
};

module.exports = nextConfig;
