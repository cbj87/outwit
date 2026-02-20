const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Support @/ alias pointing to src/
config.resolver.alias = {
  '@': path.resolve(__dirname, 'src'),
};

module.exports = config;
