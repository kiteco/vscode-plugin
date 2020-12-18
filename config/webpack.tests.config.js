'use strict';

const glob = require('glob');
const path = require('path');
const nodeExternals = require('webpack-node-externals');

const testDir = path.resolve(__dirname, '..', 'test');
const testEntries = glob
  .sync('*.test.js', { cwd: testDir, })
  .reduce((obj, filename) => {
    if (filename.includes('json')) {
      return obj;
    }
    obj[filename] = path.resolve(testDir, filename);
    return obj;
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
  },
};
