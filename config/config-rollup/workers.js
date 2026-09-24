import fs from 'node:fs'
import { basename } from 'node:path'

export const moduleWorkers = () => ({
    name: 'module-workers',
    async transform(code, id) {
        const pattern = /new URL\((['"])([^'"]+\.worker\.js)\1,\s*import\.meta\.url\)/g
        const matches = [...code.matchAll(pattern)]
        for (const match of matches.reverse()) {
            const resolved = await this.resolve(match[2], id)
            if (!resolved) this.error(`Cannot resolve worker ${match[2]} from ${id}`)
            const reference = this.emitFile({ type: 'chunk', id: resolved.id })
            code =
                code.slice(0, match.index) +
                `new URL(import.meta.ROLLUP_FILE_URL_${reference}, import.meta.url)` +
                code.slice(match.index + match[0].length)
        }
        return matches.length ? { code, map: null } : null
    },
    async resolveId(source, importer) {
        if (!source.endsWith('.wasm?url')) return null
        const resolved = await this.resolve(source.slice(0, -4), importer)
        if (!resolved) this.error(`Cannot resolve WebAssembly asset ${source}`)
        return `\0wasm-url:${resolved.id}`
    },
    load(id) {
        if (!id.startsWith('\0wasm-url:')) return null
        const file = id.slice('\0wasm-url:'.length)
        this.addWatchFile(file)
        const reference = this.emitFile({
            type: 'asset',
            name: basename(file),
            source: fs.readFileSync(file)
        })
        return `export default import.meta.ROLLUP_FILE_URL_${reference}`
    }
})
