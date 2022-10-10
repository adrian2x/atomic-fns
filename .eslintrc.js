const goodparts = require('goodparts').rules

module.exports = {
  env: {
    browser: true,
    es2021: true
  },
  extends: 'standard-with-typescript',
  overrides: [
    {
      files: ['*.ts', '*.tsx'],
    }
  ],
  parserOptions: {
    project: ['./tsconfig.xo.json'],
    ecmaVersion: 'latest',
    sourceType: 'module'
  },
  rules: {
    ...goodparts,
    semi: [1, 'never'],
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/no-dynamic-delete': 'off',
    '@typescript-eslint/no-unused-vars': 'off',
    '@typescript-eslint/restrict-plus-operands': 'off',
    '@typescript-eslint/space-before-function-paren': 'off',
    '@typescript-eslint/strict-boolean-expressions': 'off',
    '@typescript-eslint/triple-slash-reference': 'off',
    'consistent-return': 'off',
    'no-empty-function': 'off',
    'no-param-reassign': 'off',
    'no-unused-vars': 'off',
    'space-before-function-paren': 'off',
    'spaced-comment': 'off',
    'complexity': 'warn',
  }
}
