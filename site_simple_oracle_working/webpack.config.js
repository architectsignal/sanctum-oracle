const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
  entry: './index.html',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'bundle.[contenthash].js',
    clean: true,
  },
  module: {
    rules: [
      {
        test: /\.css$/,
        use: ['style-loader','css-loader'],
      },
      {
        test: /\.(png|jpg|gif|svg|pdf|mp3|mp4)$/,
        type: 'asset/resource',
        generator: {
          filename: 'assets/[hash][ext][query]'
        }
      },
      {
        test: /\.html$/,
        loader: 'html-loader'
      }
    ],
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: 'index.html',
      filename: 'index.html',
      inject: 'body'
    }),
  ],
  devServer: {
    static: './dist',
  },
};