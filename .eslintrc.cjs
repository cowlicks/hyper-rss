module.exports = {
  extends: [
    'semistandard'
  ],
  rules: {
    'one-var': 0,
    'no-unused-vars': ['error', { varsIgnorePattern: '^_', argsIgnorePattern: '^_' }],
    'comma-dangle': ['error', 'always-multiline' ],
  }

};
