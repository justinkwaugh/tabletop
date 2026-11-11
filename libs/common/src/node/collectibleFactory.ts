import { createRequire, isBuiltin } from 'node:module'
import { compileFunction } from 'node:vm'

export function evaluateLogicFactory(source: string, filename: string): unknown {
    const module = { exports: {} }
    const require = createRequire(filename)
    compileFunction(source, ['exports', 'require', 'module'], { filename })(
        module.exports,
        (id: string) => {
            if (!isBuiltin(id)) throw new Error(`Logic artifact has an unbundled dependency: ${id}`)
            return require(id)
        },
        module
    )
    return module.exports
}
