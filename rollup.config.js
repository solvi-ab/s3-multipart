import buble from 'rollup-plugin-buble';
import packageJson from './package.json'

export default {
  input: 'src/index.js',
  output: [
    {
      file: 'dist/s3-multipart.umd.js',
      format: 'umd',
      name: 'S3Multipart',
      intro: `/* ${packageJson.name} ${packageJson.version}; ${packageJson.license} Licensed, Copyright © 2019 ${packageJson.author} */`
    },
  ],
  plugins: [ buble() ]
};
