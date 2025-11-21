module.exports = {
    root: true,
    parser: '@typescript-eslint/parser',
    plugins: ['@typescript-eslint'],
    env: {
        browser: true,
        es2017: true,
        node: true
    },
    overrides: [
        {
            files: ['*.ts', '*.tsx'],
            extends: [
                'eslint:recommended',
                'plugin:@typescript-eslint/recommended',
                'plugin:svelte/recommended',
                'prettier',
                'turbo'
            ],
            parserOptions: {
                sourceType: 'module',
                ecmaVersion: 2020,
                extraFileExtensions: ['.svelte'],
                project: true
            },
            rules: {
                '@typescript-eslint/no-floating-promises': 'error',
                '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }]
            }
        },
        {
            files: ['*.svelte'],
            parser: 'svelte-eslint-parser',
            parserOptions: {
                parser: '@typescript-eslint/parser'
            }
        }
    ]
}
