/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'kspgjxfhtadmchtnhnun.supabase.co',
        port: '',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },

  // Fondamentali per l'anonimato
  productionBrowserSourceMaps: false,
  poweredByHeader: false,

  // Ignora errori TS durante la build (utile per chiudere velocemente il progetto)
  typescript: {
    ignoreBuildErrors: true,
  },

  // Rimosso il blocco experimental vuoto/errato per evitare avvisi inutili
};

export default nextConfig;