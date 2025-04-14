// @ts-check

import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { includeIgnoreFile } from '@eslint/compat'
import eslint from '@eslint/js'
import reactHooks from 'eslint-plugin-react-hooks'
import tseslint from 'typescript-eslint'

const parentDir = path.dirname(fileURLToPath(import.meta.url))
const gitignorePath = path.resolve(parentDir, '.gitignore')

export default tseslint.config(
  includeIgnoreFile(gitignorePath),
  {
    ignores: ['app/lib/core/**', 'app/lib/modules/**', 'app/lib/animation.ts'],
  },
  eslint.configs.recommended,
  tseslint.configs.recommended,
  reactHooks.configs['recommended-latest'],
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      eqeqeq: 'error',
      'no-param-reassign': 'error',
      'no-return-assign': 'error',
    },
  },
)
