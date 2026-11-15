import fs from 'node:fs'
import path from 'node:path'
import { marked } from 'marked'
import type { Plugin } from 'vite'
import { LEGAL_DOCUMENT_KINDS } from './src/lib/legal/legalDocumentKinds.js'

const MODULE_ID = 'virtual:legal-documents'
const RESOLVED_MODULE_ID = `\0${MODULE_ID}`

// The site builds into a single chunk (codeSplitting in vite.config.ts), so rendering here keeps
// the Markdown parser out of every visitor's download.
export function legalDocuments(): Plugin {
    let folder = ''
    return {
        name: 'legal-documents',
        configResolved(config) {
            folder = path.join(config.root, 'legal')
        },
        configureServer(server) {
            server.watcher.add(folder)
            const reloadOnDocumentChange = (file: string) => {
                if (path.dirname(file) !== folder) return
                const module = server.moduleGraph.getModuleById(RESOLVED_MODULE_ID)
                if (module) server.moduleGraph.invalidateModule(module)
                server.ws.send({ type: 'full-reload' })
            }
            for (const event of ['add', 'change', 'unlink'] as const) {
                server.watcher.on(event, reloadOnDocumentChange)
            }
        },
        resolveId(id) {
            return id === MODULE_ID ? RESOLVED_MODULE_ID : undefined
        },
        load(id) {
            if (id !== RESOLVED_MODULE_ID) return undefined
            const documents = Object.fromEntries(
                LEGAL_DOCUMENT_KINDS.flatMap((kind) => {
                    const file = path.join(folder, `${kind}.md`)
                    if (!fs.existsSync(file)) return []
                    return [[kind, marked.parse(fs.readFileSync(file, 'utf8'), { async: false })]]
                })
            )
            return `export default ${JSON.stringify(documents)}`
        }
    }
}
