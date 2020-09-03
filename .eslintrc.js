module.exports = {
  "env": {
    "commonjs": true,
    "es6": true,
    "node": true
  },
  "extends": "eslint:recommended",
  "globals": {
    "Atomics": "readonly",
    "SharedArrayBuffer": "readonly"
  },
  "parserOptions": {
    "ecmaVersion": 2018
  },
  "overrides": [
    {
      files: [
        'test/**.js'
      ],
      env: {
        mocha: true
      },
      plugins: ['mocha'],
      extends: ['plugin:mocha/recommended'],
      rules: {
      }
    },
  ],
  "rules": {
    "indent": [2,2],
    "require-atomic-updates": "off"
  }
};
