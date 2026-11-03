import eslint from '@eslint/js'
import tseslint from 'typescript-eslint'
import prettier from 'eslint-config-prettier'
export default tseslint.config(
  { ignores: ['dist', 'docs', 'coverage', 'consumer', 'scripts'] },
  eslint.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    rules: {
      // Conflicts with Global rule forbidding non-null ! assertions.
      '@typescript-eslint/non-nullable-type-assertion-style': 'off',
      // Override params kept for signature match (e.g. FrozenSet.add).
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_', varsIgnorePattern: '^_' }
      ]
    }
  },
  prettier,
  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname }
    }
  }
)
