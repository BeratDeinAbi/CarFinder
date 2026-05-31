/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Diese Pakete NICHT von Webpack bündeln, sondern zur Laufzeit aus node_modules
    // laden. Sonst findet Playwright die installierten Browser nicht ("Executable
    // doesn't exist"), weil das Bundling die Pfad-Auflösung kaputt macht.
    serverComponentsExternalPackages: [
      'playwright',
      'playwright-core',
      'playwright-extra',
      'puppeteer-extra',
      'puppeteer-extra-plugin-stealth',
    ],
  },
};

module.exports = nextConfig;
