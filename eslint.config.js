import js from '@eslint/js'
import vue from 'eslint-plugin-vue'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import vueParser from 'vue-eslint-parser'

export default [
  {
    ignores: ['dist', 'node_modules'],
  },
  js.configs.recommended,
  ...vue.configs['flat/recommended'],
  ...tseslint.configs.recommended,
  {
    files: ['**/*.ts'],
    languageOptions: {
      globals: globals.browser,
      parserOptions: {
        parser: tseslint.parser,
      },
    },
  },
  {
    files: ['**/*.vue'],
    languageOptions: {
      globals: globals.browser,
      parser: vueParser,
      parserOptions: {
        parser: tseslint.parser,
      },
    },
  },
]
