import { isBuiltin } from 'node:module'

// V8 holds a source with any character outside Latin-1 at two bytes per character, and Node does
// the same for a file over 1 MB with any non-ASCII byte, so logic is emitted ASCII-only. Rolldown
// leaves comment text unescaped, so only licence notices are kept.
export const asciiOutput = {
    charset: 'ascii',
    comments: { legal: true, annotation: false, jsdoc: false }
}

export const nonAsciiProblem = (code) => {
    const found = /[\u0080-\uffff]/.exec(code)
    if (!found) return undefined
    const line = code.slice(0, found.index).split('\n').length
    const codePoint = found[0].charCodeAt(0).toString(16).toUpperCase().padStart(4, '0')
    return `Logic must be ASCII-only: line ${line} of the bundle holds U+${codePoint}, which Rolldown cannot escape inside a tagged template or a licence comment`
}

// The backend evaluates a logic factory with only Node's builtins available to it.
export const collectibleChunkProblem = (chunk) => {
    if (chunk.imports.some((id) => !isBuiltin(id)) || chunk.dynamicImports.length) {
        return 'Logic must be a single bundle with only Node builtin imports'
    }
    return undefined
}

// Fails a logic build whose CommonJS factory would need anything but Node's builtins, or whose
// source V8 would hold at two bytes per character.
export const collectibleLogic = () => ({
    name: 'collectible-logic',
    generateBundle(options, output) {
        if (options.format !== 'cjs') return
        const chunk = Object.values(output).find((item) => item.type === 'chunk' && item.isEntry)
        const problem = chunk
            ? (collectibleChunkProblem(chunk) ?? nonAsciiProblem(chunk.code))
            : 'Logic bundle has no entry chunk'
        if (problem) this.error(problem)
    }
})
