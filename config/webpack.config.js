'use strict';

const path = require('path');
const fs = require('fs');
const MergeIntoSingleFilePlugin = require('webpack-merge-and-include-globally');
const CopyPlugin = require('copy-webpack-plugin');

const ASSETS_PATH = path.resolve(__dirname, '..', 'assets');

const getAssetsOfType = type => fs.readdirSync(path.resolve(ASSETS_PATH, type))
  .map(p => path.resolve(ASSETS_PATH, type, p));

const assetsPathOfType = type => `assets/${type}`;

/**@type {import('webpack').Configuration}*/
const config = {
  target: 'node',

  entry: {
    extension: path.resolve(__dirname, '..', 'src', 'kite.js'),
  },
  output: {
    // the bundle is stored in the 'dist' folder (check package.json)
    path: path.resolve(__dirname, '..', 'dist'),
    filename: 'kite-extension.js',
    libraryTarget: 'commonjs2',
    devtoolModuleFilenameTemplate: '../[resource-path]'
  },
  devtool: 'source-map',
  externals: {
    vscode: 'commonjs vscode', // the vscode-module is created on-the-fly and must be excluded.
    atom: 'atom' // because kite-installer imports it (has null checks around its usage, though)
  },
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
    extensions: ['.ts', '.js']
  },
  plugins: [
    // static asset merging and copying
    new MergeIntoSingleFilePlugin({
      files: {
        [`${assetsPathOfType('js')}/assets.js`]: getAssetsOfType('js'),
        [`${assetsPathOfType('css')}/assets.css`]: getAssetsOfType('css')
      },
      transform: {
        [`${assetsPathOfType('js')}/assets.js`]: code => require('terser').minify(code).code
      }
    }),
    new CopyPlugin([
      {
        from: 'images/',
        to: path.resolve(__dirname, '..', 'dist', assetsPathOfType('images/'))
      },
      {
        from: 'fonts/',
        to: path.resolve(__dirname, '..', 'dist', assetsPathOfType('fonts/'))
      }
    ], {
      context: ASSETS_PATH
    })
  ]
};
module.exports = config;
