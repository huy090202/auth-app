import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/**', 'dist-ssr/**'] },
  ...tseslint.configs.recommended,
);
