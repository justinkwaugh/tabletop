import { createRequire, isBuiltin } from 'node:module'
import path from 'node:path'
import AjvCompiler from '@fastify/ajv-compiler'
import standalone from 'ajv/dist/standalone/index.js'
import { rollup } from 'rollup'
import resolve from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'
import {
    actionRequestSchema,
    createGameRequestSchema,
    titleAjvOptions,
    titleActionAjvOptions
} from '@tabletop/common'

const localRequire = createRequire(import.meta.url)
const require = createRequire(localRequire.resolve('@fastify/ajv-compiler'))

// The backend evaluates a logic factory with only Node's builtins available to it.
export const collectibleChunkProblem = (chunk) => {
    if (chunk.imports.some((id) => !isBuiltin(id)) || chunk.dynamicImports.length) {
        return 'Logic must be a single bundle with only Node builtin imports'
    }
    return undefined
}

// Converts a published ESM logic bundle into the CommonJS factory the backend evaluates, for
// artifacts published before the build emitted one.
export async function buildLogicFactorySource(esmFilename) {
    const build = await rollup({ input: esmFilename, external: isBuiltin, logLevel: 'silent' })
    try {
        const { output } = await build.generate({ format: 'cjs', inlineDynamicImports: true })
        const chunk = output.find((item) => item.type === 'chunk' && item.isEntry)
        const problem = chunk ? collectibleChunkProblem(chunk) : 'Logic bundle has no entry chunk'
        if (problem) throw new Error(problem)
        return chunk.code
    } finally {
        await build.close()
    }
}

// Compiles a title's create and action request validators with the options the backend uses,
// into one self-contained CommonJS module keyed by `create` and `action:<type>`.
export async function buildValidatorsSource(Definition, outputDir) {
    const sources = []
    const schemas = [
        ['create', createGameRequestSchema(Definition.info.configurator?.schema), titleAjvOptions],
        ...Object.entries(Definition.runtime.apiActions).map(([type, schema]) => [
            `action:${type}`,
            actionRequestSchema(schema),
            titleActionAjvOptions
        ])
    ]
    for (const [index, [key, schema, options]] of schemas.entries()) {
        let ajv
        const compile = AjvCompiler()(
            {},
            {
                ...options,
                customOptions: { ...options.customOptions, code: { source: true } },
                onCreate: (instance) => {
                    ajv = instance
                }
            }
        )
        const validate = compile({ schema, method: 'POST', url: key, httpPart: 'body' })
        sources.push({ key, code: standalone(ajv, validate), index })
    }
    const entry = path.join(outputDir, '.validators.mjs')
    const validatorId = (index) => path.join(outputDir, `.validator-${index}.cjs`)
    const build = await rollup({
        input: entry,
        plugins: [
            {
                name: 'generated-validators',
                resolveId(id) {
                    if (id === entry || sources.some(({ index }) => id === validatorId(index)))
                        return id
                    if (id.startsWith('ajv/') || id.startsWith('ajv-formats/'))
                        return require.resolve(id)
                },
                load(id) {
                    if (id === entry)
                        return sources
                            .map(
                                ({ key, index }) =>
                                    `import v${index} from ${JSON.stringify(validatorId(index))}; exports[${JSON.stringify(key)}] = v${index};`
                            )
                            .join('\n')
                    return sources.find(({ index }) => id === validatorId(index))?.code
                }
            },
            resolve({ preferBuiltins: true }),
            commonjs()
        ]
    })
    try {
        const { output } = await build.generate({ format: 'cjs', inlineDynamicImports: true })
        const generated = output.find((item) => item.type === 'chunk')
        if (!generated || generated.imports.length || generated.dynamicImports.length) {
            throw new Error('Validators must be self-contained')
        }
        return generated.code
    } finally {
        await build.close()
    }
}
