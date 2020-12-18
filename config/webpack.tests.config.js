'use strict';

const glob = require('glob');
const path = require('path');
const nodeExternals = require('webpack-node-externals');

const testDir = path.resolve(__dirname, '..', 'test');
const testEntries = glob.sync('*.test.js', {
  cwd: testDir,
}).reduce((acc, p) => {
  if (p.includes('json')) {
    return acc;
  }
  acc[p] = path.resolve(testDir, p);
  return acc;
}, {});

module.exports = {
  entry: {
    ['runTests.js']: path.resolve(__dirname, '..', 'test', 'runTests.js'),
    ['index.js']: path.resolve(__dirname, '..', 'test', 'index.ts'),
    ...testEntries
  },
  output: {
    path: path.resolve(__dirname, '..', 'out', 'test'),
    filename: '[name]',
    libraryTarget: 'commonjs2',
    devtoolModuleFilenameTemplate: '../[resource-path]'
  },
  target: 'node',
  externals: [
    {
      vscode: 'commonjs2 vscode',
      fs: 'commonjs2 fs',
      crypto: 'commonjs2 crypto',
      child_process: 'commonjs2 child_process',
    },
    nodeExternals()
  ],
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: ['.ts', '.js'],
    roots: [
      __dirname,
      path.resolve(__dirname, '..', 'out', 'test'),
    ]
  },
};
