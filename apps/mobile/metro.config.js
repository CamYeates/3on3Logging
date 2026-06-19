// Metro config tuned for an npm-workspaces monorepo so the app can import the
// `@3on3/shared` package from /packages/shared.
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// 1. Watch all files in the monorepo.
config.watchFolders = [monorepoRoot];

// 2. Resolve modules from the app's and the monorepo's node_modules.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

// 3. Avoid resolving duplicate copies of packages.
config.resolver.disableHierarchicalLookup = false;

module.exports = config;
