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
        // ambisonics and its old IRCAM dependencies (serve-sofa-hrir,
        // fractional-delay, ...) declare invalid "exports" fields that
        // webpack 5 rejects. Ignore "exports" only for imports made from
        // inside ambisonics' dependency tree; everything else is unaffected.
        test: /[\\/]node_modules[\\/](ambisonics|serve-sofa-hrir|fractional-delay)[\\/]/,
        resolve: { exportsFields: [] }
      },
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
