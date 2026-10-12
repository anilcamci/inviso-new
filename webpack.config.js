const path = require('path');
const webpack = require('webpack');

const PROD = process.env.NODE_ENV === 'production';

module.exports = {
  mode: PROD ? 'production' : 'development',
  entry: [
    './node_modules/regenerator-runtime/runtime.js',
    './src/js/app.js'
  ],
  output: {
    filename: 'app.js',
    path: PROD
      ? path.join(__dirname, 'build/public/assets/js')
      : path.join(__dirname, 'src/public/assets/js'),
    publicPath: '/assets/js/'
  },
  devtool: PROD ? 'source-map' : 'eval-cheap-module-source-map',
  devServer: {
    static: path.join(__dirname, 'src/public'),
    hot: true,
    port: 8080
  },
  module: {
    rules: [
      {
        test: /\.scss$/,
        use: [
          "style-loader",
          "css-loader",
          {
            loader: "sass-loader",
            options: {
              implementation: require("sass")
            }
          }
        ]
      },
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            retainLines: true,
            presets: ['@babel/preset-env']
          }
        }
      }
    ]
  },
  plugins: [
    new webpack.DefinePlugin({
      __ENV__: JSON.stringify(PROD ? 'prod' : 'dev'),
      ___BUILD_TIME___: Date.now(),
    })
  ],
  optimization: {
    minimize: PROD
  }
};
