// rollup.config.js
import { terser } from '@rollup/plugin-terser';

export default {
  input: 'src/index.js', // adjust if your entry file is different
  output: {
    file: 'build/bundle.min.js', // output file path
    format: 'iife', // immediately-invoked function expression format for browsers
    name: 'bundle'
  },
  plugins: [
    terser()
  ]
};
