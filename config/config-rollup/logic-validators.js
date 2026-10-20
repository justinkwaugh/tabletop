import path from 'node:path'
import { evaluateLogicFactory } from '@tabletop/common/node/collectible-factory'
import { buildValidatorsSource, collectibleChunkProblem } from './logic-sidecars.js'

// Emits validators.cjs beside a logic bundle's CommonJS factory, so the backend never compiles
// a title's request schemas itself.
export const logicValidators = (outputDir) => ({
    name: 'logic-validators',
    async generateBundle(options, output) {
        if (options.format !== 'cjs') return
        const chunk = Object.values(output).find((item) => item.type === 'chunk' && item.isEntry)
        const problem = chunk ? collectibleChunkProblem(chunk) : 'Logic bundle has no entry chunk'
        if (problem) this.error(problem)
        const { Definition } = evaluateLogicFactory(chunk.code, path.join(outputDir, 'index.cjs'))
        let source
        try {
            source = await buildValidatorsSource(Definition, outputDir)
        } catch (error) {
            this.error(error instanceof Error ? error.message : String(error))
        }
        this.emitFile({ type: 'asset', fileName: 'validators.cjs', source })
    }
})
