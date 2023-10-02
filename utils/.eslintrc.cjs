module.exports = {
  env: {
    es2021: true,
    browser: true,
  },
  extends: [
    'airbnb-base',
  ],
  parserOptions: {
    parser: '@typescript-eslint/parser',
    ecmaVersion: 12,
    sourceType: 'module',
  },
  plugins: [
    '@typescript-eslint',
  ],
  rules: {
    'import/no-extraneous-dependencies': ['error', { packageDir: __dirname }],
    'eol-last': ['error', 'always'],
    'import/prefer-default-export': ['off'],
    'no-param-reassign': ['error', { props: false }],
    'no-return-assign': ['error', 'except-parens'],
    'no-unused-vars': ['error', { args: 'after-used' }],
    'no-restricted-syntax': ['off', ['ForOfStatement']],
    'max-len': ['error', { code: 120 }],
    'no-plusplus': ['error', { allowForLoopAfterthoughts: true }],
    'no-underscore-dangle': ['off'],
    'max-classes-per-file': ['off'],
    'import/extensions': [
      'error',
      'ignorePackages', {
        js: 'never',
        ts: 'never',
      },
    ],
    '@typescript-eslint/no-unused-vars': [
      'error',
      {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
      },
    ],
    // I like to group vars semantically
    'one-var-declaration-per-line': ['off'],
    'one-var': ['off'],
  },
  settings: {
    'import/resolver': {
      typescript: {},
      node: {
        extensions: ['.js', '.ts'],
      },
    },
  },
};
