module.exports = {
  "env": {
    "es6": true,
    "node": true
  },
  "extends": [
    "eslint:recommended",
    "plugin:import/recommended",
  ],
  "globals": {
    "Atomics": "readonly",
    "SharedArrayBuffer": "readonly"
  },
  // needed for import.meta
  "parser": "@babel/eslint-parser",
  "parserOptions": {
    "ecmaVersion": 2022,
    "sourceType": "module",
    "requireConfigFile": false,
    "babelOptions": {
      "babelrc": false,
      "configFile": false,
      "presets": ["@babel/preset-env"],
    },
  },
  "overrides": [
    {
      files: [
        "test/**.js"
      ],
      env: {
        mocha: true
      },
      plugins: ["mocha"],
      extends: [
        "eslint:recommended",
        "plugin:import/recommended",
        "plugin:mocha/recommended"
      ],
      rules: {
      }
    },
  ],
  "rules": {
    "indent": ["error", 2],
    "quotes": ["error", "double"],
    "key-spacing": ["error", {"mode": "strict"}],
    "require-atomic-updates": "off",
    "import/extensions": ["error", "ignorePackages"],
  },
};
