import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { paraglideVitePlugin } from '@inlang/paraglide-js'
import type { Plugin } from 'vite'
import { PSEUDO_LOCALE, pseudoLocalizeMessages } from './src/lib/i18n/pseudoLocale.js'

const appRoot = path.dirname(fileURLToPath(import.meta.url))
const baseMessagesFile = path.join(appRoot, 'messages', 'en.json')
const pseudoMessagesFile = path.join(appRoot, 'messages', `${PSEUDO_LOCALE}.json`)

export function siteMessages(): Plugin[] {
    return [
        pseudoLocale(),
        paraglideVitePlugin({ project: path.join(appRoot, 'project.inlang') })
    ].flat()
}

// Builds leave the pseudo-locale empty so production bundles carry no pseudo strings.
function pseudoLocale(): Plugin {
    let pseudoStrings = false
    return {
        name: 'pseudo-locale',
        config(_config, { command }) {
            pseudoStrings = command === 'serve'
            writePseudoMessages(pseudoStrings)
        },
        configureServer(server) {
            server.watcher.add(baseMessagesFile)
            server.watcher.on('change', (file) => {
                if (file === baseMessagesFile) writePseudoMessages(pseudoStrings)
            })
        }
    }
}

function writePseudoMessages(pseudoStrings: boolean) {
    const base: Record<string, unknown> = JSON.parse(fs.readFileSync(baseMessagesFile, 'utf8'))
    const messages = pseudoStrings ? pseudoLocalizeMessages(base) : { $schema: base.$schema }
    const contents = `${JSON.stringify(messages, null, 4)}\n`
    if (
        fs.existsSync(pseudoMessagesFile) &&
        fs.readFileSync(pseudoMessagesFile, 'utf8') === contents
    )
        return
    fs.writeFileSync(pseudoMessagesFile, contents)
}
