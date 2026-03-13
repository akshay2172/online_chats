// backend/eslint.config.mjs  
import tseslint from '@typescript-eslint/eslint-plugin';  
import tsparser from '@typescript-eslint/parser';  
  
export default [  
  {  
    files: ['src/**/*.ts'],  
    languageOptions: {  
      parser: tsparser,  
      parserOptions: {  
        sourceType: 'module',  
      },  
      globals: {  
        process: 'readonly',  
        console: 'readonly',  
        __dirname: 'readonly',  
        __filename: 'readonly',  
      },  
    },  
    plugins: {  
      '@typescript-eslint': tseslint,  
    },  
    rules: {  
      ...tseslint.configs.recommended.rules,  
      '@typescript-eslint/no-unused-vars': 'warn',  
      '@typescript-eslint/no-explicit-any': 'warn',  
    },  
  },  
];