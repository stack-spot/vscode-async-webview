const singleLineString = "^\\s*[^']*'([^']|(\\\\'))*'\\)*,?;?$"
const doubleQuoted = singleLineString.replace(/'/g, '"')
const template = singleLineString.replace(/'/g, '`')

const maxLengthIgnorePattern = `(${singleLineString})|(${doubleQuoted})|(${template})`

module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  extends: [
    'plugin:@typescript-eslint/recommended',
  ],
  plugins: ['@typescript-eslint', 'import', 'filenames'],
  ignorePatterns: ['**/node_modules/**', '**/dist/**', '**/out/**', '**/generated/**'],
  rules: {
    'prettier/prettier': 'off',
    'max-len': ['error', { code: 140, ignorePattern: maxLengthIgnorePattern }],
    'arrow-body-style': ['error', 'as-needed'],
    'eol-last': ['error', 'always'],
    quotes: ['error', 'single', { avoidEscape: true }],
    'comma-dangle': ['error', 'always-multiline'],
    'comma-spacing': ['error', { before: false, after: true }],
    semi: ['error', 'never'],
    'space-in-parens': ['error', 'never'],
    'keyword-spacing': ['error', { before: true, after: true }],
    'array-bracket-spacing': ['error', 'never'],
    'object-curly-spacing': ['error', 'always'],
    'import/no-default-export': 'error',
    'import/no-extraneous-dependencies': 'off',
    'import/order': ['warn', {
      groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
      'newlines-between': 'ignore',
    }],
    'filenames/match-regex': [2, /(^[a-z-\.]+$)|(^[A-Z][A-z\.]*$)/, true],
    'no-console': 'warn',
    'no-restricted-syntax': [
      'error',
      {
        'selector': 'TSEnumDeclaration',
        'message': 'Do not declare enums',
      },
    ],
    curly: 'off',
    indent: ['error', 2, { SwitchCase: 1 }],
    quotes: ['error', 'single', { avoidEscape: true }],
    semi: ['error', 'never'],
    '@typescript-eslint/no-non-null-assertion': 'off',
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/ban-ts-ignore': 'off',
    '@typescript-eslint/no-empty-function': 'off',
    '@typescript-eslint/member-delimiter-style': ['error', {
      multiline: { delimiter: 'comma', requireLast: true },
      singleline: { delimiter: 'comma', requireLast: false },
    }],
    '@typescript-eslint/ban-ts-comment': 'off',
    '@typescript-eslint/no-unused-vars': ['error', { varsIgnorePattern: '^_' }],
    'react-hooks/exhaustive-deps': 'off',
  },
}

