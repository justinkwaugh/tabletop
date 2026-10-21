import { isBuiltin } from 'node:module'
import { rollup } from 'rollup'

// The backend evaluates a logic factory with only Node's builtins available to it.
export const collectibleChunkProblem = (chunk) => {
    if (chunk.imports.some((id) => !isBuiltin(id)) || chunk.dynamicImports.length) {
        return 'Logic must be a single bundle with only Node builtin imports'
    }
    return undefined
}

// Fails a logic build whose CommonJS factory would need anything but Node's builtins.
export const collectibleLogic = () => ({
    name: 'collectible-logic',
    generateBundle(options, output) {
        if (options.format !== 'cjs') return
        const chunk = Object.values(output).find((item) => item.type === 'chunk' && item.isEntry)
        const problem = chunk ? collectibleChunkProblem(chunk) : 'Logic bundle has no entry chunk'
        if (problem) this.error(problem)
    }
})

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
