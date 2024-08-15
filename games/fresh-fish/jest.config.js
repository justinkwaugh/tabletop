/** @type {import('ts-jest').JestConfigWithTsJest} **/
export default {
    testEnvironment: 'node',
    moduleDirectories: ['../node_modules', 'node_modules', 'src'],
    moduleFileExtensions: ['js', 'json', 'ts'],
    transform: {
        '^.+.tsx?$': ['ts-jest', { useESM: true }],
        '^.+\\.(js|jsx)$': 'babel-jest'
    },
    moduleNameMapper: {
        '(.+)\\.js': '$1',
        '^@atabletop/common/(.*)$': '<rootDir>/libs/common/src/$1/'
    },
    preset: 'ts-jest/presets/default-esm',
    extensionsToTreatAsEsm: ['.ts']
}
