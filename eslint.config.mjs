import path from 'node:path'
import { fileURLToPath } from 'node:url'
import js from '@eslint/js'
import globals from 'globals'
import turbo from 'eslint-config-turbo/flat'
import tsParser from '@typescript-eslint/parser'
import tsPlugin from '@typescript-eslint/eslint-plugin'
import svelte from 'eslint-plugin-svelte'

const tsconfigRootDir = path.dirname(fileURLToPath(import.meta.url))

const svelteRunesGlobals = {
    $state: 'readonly',
    $derived: 'readonly',
    $effect: 'readonly',
    $props: 'readonly',
    $bindable: 'readonly',
    $inspect: 'readonly',
    $host: 'readonly'
}

const baseGlobals = {
    ...globals.browser,
    ...globals.node,
    ...svelteRunesGlobals
}

export default [
    {
        ignores: [
            '**/node_modules/**',
            '**/dist/**',
            '**/build/**',
            '**/.svelte-kit/**',
            '**/bundle/**',
            '**/esm/**',
            '**/*.config.ts',
            '**/*.config.js',
            '**/*.config.cjs',
            '**/*.config.mjs',
            '**/svelte.config.js',
            '**/tailwind.config.ts',
            '**/src/service-worker.ts',
            '**/src/service-worker/**/*.ts'
        ]
    },
    js.configs.recommended,
    ...turbo,
    ...svelte.configs['flat/recommended'],
    ...svelte.configs['flat/prettier'],
    {
        files: ['**/*.{ts,tsx,js,jsx}'],
        languageOptions: {
            parser: tsParser,
            parserOptions: {
                sourceType: 'module',
                ecmaVersion: 2020,
                project: ['**/tsconfig.json', '**/tsconfig.*.json'],
                tsconfigRootDir
            },
            globals: baseGlobals
        },
        plugins: {
            '@typescript-eslint': tsPlugin
        },
        rules: {
            ...tsPlugin.configs.recommended.rules,
            'no-unused-vars': 'off',
            'no-redeclare': 'off',
            '@typescript-eslint/no-floating-promises': 'error',
            '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
            '@typescript-eslint/no-redeclare': 'off'
        }
    },
    {
        files: ['**/*.svelte'],
        languageOptions: {
            parser: svelte.parser,
            parserOptions: {
                parser: tsParser
            },
            globals: {
                ...baseGlobals
            }
        },
        rules: {
            'no-undef': 'off',
            'no-unused-vars': 'off'
        }
    }
]
