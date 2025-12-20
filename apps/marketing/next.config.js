const path = require('path')

const tamaguiPackages = [
  'tamagui',
  '@tamagui/animations-css',
  '@tamagui/core',
  '@tamagui/helpers',
  '@tamagui/stacks',
  '@tamagui/themes',
  '@tamagui/web',
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: tamaguiPackages,
  experimental: {
    optimizePackageImports: ['tamagui'],
  },
  turbopack: {
    root: path.join(__dirname, '..', '..'),
    resolveAlias: {
      'react-native$': 'react-native-web',
    },
    resolveExtensions: [
      '.web.js',
      '.web.jsx',
      '.web.ts',
      '.web.tsx',
      '.ts',
      '.tsx',
      '.mjs',
      '.cjs',
      '.js',
      '.jsx',
      '.json',
    ],
  },
  webpack: (config) => {
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      'react-native$': 'react-native-web',
    };
    config.resolve.extensions = [
      '.web.js',
      '.web.jsx',
      '.web.ts',
      '.web.tsx',
      ...config.resolve.extensions,
    ];
    return config;
  },
};

module.exports = nextConfig;
