import config from '@tabletop/eslint-config'

export default [
    ...config,
    {
        // The deploy CLI reads its configuration from the environment when it runs,
        // outside turbo, so turbo's task env declarations don't apply to it.
        files: ['**/*.ts'],
        rules: {
            'turbo/no-undeclared-env-vars': 'off'
        }
    }
]
