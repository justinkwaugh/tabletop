import js from '@eslint/js'
import tsPlugin from '@typescript-eslint/eslint-plugin'
import tsParser from '@typescript-eslint/parser'
import prettier from 'eslint-config-prettier'
import turbo from 'eslint-config-turbo/flat'
import svelte from 'eslint-plugin-svelte'
import globals from 'globals'
import { existsSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import ts from 'typescript'

const tsFiles = ['**/*.ts', '**/*.tsx']
const ignoredDirs = [
    'node_modules',
    'out',
    'dist',
    'esm',
    'build',
    'bundle',
    'coverage',
    '.svelte-kit',
    'package'
]

const scopeTo = (files, configs) => configs.map((config) => ({ ...config, files }))

// Packages run `eslint .` from their own directory. Type-aware rules need every
// linted file to belong to a tsconfig, but several packages exclude specs (or,
// for SvelteKit, the service worker) from theirs. Those files are linted
// without type information instead of failing to parse.
function filesOutsideTsconfig(root) {
    const configPath = ts.findConfigFile(root, ts.sys.fileExists)
    if (!configPath) return []
    const { config } = ts.readConfigFile(configPath, ts.sys.readFile)
    const parsed = ts.parseJsonConfigFileContent(config, ts.sys, path.dirname(configPath))
    const inProject = new Set(parsed.fileNames.map((file) => path.resolve(file)))

    return readdirSync(root, { recursive: true, withFileTypes: true })
        .filter((entry) => entry.isFile() && /\.tsx?$/.test(entry.name))
        .map((entry) => path.join(entry.parentPath, entry.name))
        .filter((file) => !inProject.has(file))
        .map((file) => path.relative(root, file).split(path.sep))
        .filter((segments) => !segments.some((segment) => ignoredDirs.includes(segment)))
        .map((segments) => segments.join('/').replace(/[[\]{}()*?!]/g, '\\$&'))
}

const untypedTsFiles = filesOutsideTsconfig(process.cwd())

// eslint-plugin-svelte reads the package's compiler options (runes mode etc.) from svelte.config.js
const svelteConfigPath = path.join(process.cwd(), 'svelte.config.js')
const svelteConfig = existsSync(svelteConfigPath)
    ? (await import(pathToFileURL(svelteConfigPath).href)).default
    : undefined

export default [
    {
        ignores: [
            ...ignoredDirs.filter((dir) => dir !== 'node_modules').map((dir) => `**/${dir}/**`),
            '**/*.config.ts'
        ]
    },
    {
        plugins: {
            '@typescript-eslint': tsPlugin
        },
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            globals: {
                ...globals.browser,
                ...globals.node,
                ...globals.es2017
            }
        }
    },
    ...svelte.configs.recommended,
    ...svelte.configs.prettier,
    {
        rules: {
            // Flags every mutable Map/Set/Date/URL. Here those are almost always local
            // builders or non-rendered registries (listeners, element refs, timelines).
            'svelte/prefer-svelte-reactivity': 'off',
            // No app sets a base path yet; resolve() would add typed routes when adopted.
            'svelte/no-navigation-without-resolve': 'warn',
            // Also reports whitespace holders like {' '}, which prettier-plugin-svelte writes
            // itself to keep spaces next to tags; there is no option to exempt them.
            'svelte/no-useless-mustaches': 'off'
        }
    },
    {
        files: ['**/*.svelte'],
        languageOptions: {
            parserOptions: {
                parser: tsParser,
                projectService: true,
                tsconfigRootDir: process.cwd(),
                extraFileExtensions: ['.svelte'],
                svelteConfig
            }
        }
    },
    ...scopeTo(tsFiles, [
        js.configs.recommended,
        ...tsPlugin.configs['flat/recommended'],
        prettier,
        ...turbo
    ]),
    {
        files: tsFiles,
        languageOptions: {
            parser: tsParser,
            parserOptions: {
                projectService: true,
                tsconfigRootDir: process.cwd(),
                extraFileExtensions: ['.svelte']
            }
        },
        rules: {
            '@typescript-eslint/no-floating-promises': 'error',
            '@typescript-eslint/no-unused-vars': [
                'error',
                {
                    argsIgnorePattern: '^_',
                    varsIgnorePattern: '^_',
                    caughtErrorsIgnorePattern: '^_',
                    destructuredArrayIgnorePattern: '^_',
                    ignoreRestSiblings: true
                }
            ]
        }
    },
    ...(untypedTsFiles.length > 0
        ? scopeTo(untypedTsFiles, [
              tsPlugin.configs['flat/disable-type-checked'],
              { languageOptions: { parserOptions: { projectService: false } } }
          ])
        : [])
]
