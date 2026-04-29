/* ESLint config — TypeScript + JavaScript across Codebase/Backend */
module.exports = {
  root: true,
  env: {
    node: true,
    es2022: true
  },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'commonjs',
    project: ['./tsconfig.json'],
    tsconfigRootDir: __dirname
  },
  plugins: ['@typescript-eslint'],
  ignorePatterns: ['dist/', 'node_modules/', 'outputs/'],
  overrides: [
    {
      files: ['**/*.ts'],
      extends: [
        'eslint:recommended',
        'plugin:@typescript-eslint/recommended-type-checked',
        'plugin:@typescript-eslint/strict-type-checked'
      ],
      rules: {
        '@typescript-eslint/no-explicit-any': 'error',
        '@typescript-eslint/no-floating-promises': 'error',
        '@typescript-eslint/no-misused-promises': 'error',
        '@typescript-eslint/consistent-type-imports': 'warn',
        '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
        'no-console': 'off'
      }
    },
    {
      files: ['**/*.js'],
      extends: ['eslint:recommended'],
      parserOptions: { project: null },
      rules: {
        'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }]
      }
    }
  ]
};
