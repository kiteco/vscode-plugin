'use strict';

const glob = require('glob');
const path = require('path');
const nodeExternals = require('webpack-node-externals');
const CopyPlugin = require('copy-webpack-plugin');

const OUT_TEST_DIR = path.resolve(__dirname, '..', 'out', 'test');
const TEST_DIR = path.resolve(__dirname, '..', 'test');

const TestNeedsUpdating = {
  'autostart.test.js': true,
  'json-runner.test.js': true,
};

const testEntries = glob
  .sync('*.test.js', { cwd: TEST_DIR })
  .reduce((obj, filename) => {
    if (!TestNeedsUpdating[filename]) {
      obj[filename] = path.resolve(TEST_DIR, filename);
    }
    return obj;
  }, {});

module.exports = {
  entry: {
    ['runTests.js']: path.resolve(__dirname, '..', 'test', 'runTests.js'),
    ['index.js']: path.resolve(__dirname, '..', 'test', 'index.ts'),
    ...testEntries
  },
  output: {
    path: OUT_TEST_DIR,
    filename: '[name]',
    libraryTarget: 'commonjs2',
    devtoolModuleFilenameTemplate: '../[resource-path]'
  },
  devtool: 'source-map',
  target: 'node',
  externals: [
    {
      vscode: 'commonjs2 vscode',
      fs: 'commonjs2 fs',
      crypto: 'commonjs2 crypto',
      child_process: 'commonjs2 child_process',
      ['editors-json-tests']: 'commonjs2 editors-json-tests',
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
  plugins: [
    new CopyPlugin([
      {
        from: 'fixtures/',
        to: path.resolve(OUT_TEST_DIR, 'fixtures/')
      }
    ],
    { context: TEST_DIR }
    )
  ],
};
