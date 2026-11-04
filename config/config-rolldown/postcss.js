import { readFileSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/postcss'

const KeyframeRules = ['keyframes', '-webkit-keyframes', '-moz-keyframes']
// GameInfo's own property, at its indent: a comment or a nested id above it is not the game's.
const GameInfoId = /GameInfo\s*=\s*\{[\s\S]*?^ {4}id:\s*'([^']+)'/m

/**
 * The game id of the UI package at `packageRoot`, from its logic package's `GameInfo`. It is what
 * the site's `GameUI` puts on a title's root as `data-game-ui`, so it is read and never typed.
 */
export function gameUiId(packageRoot) {
    const folder = basename(packageRoot)
    if (!folder.endsWith('-ui')) throw new Error(`${folder} is not a game UI package`)
    const infoFile = join(
        dirname(packageRoot),
        folder.slice(0, -'-ui'.length),
        'src/definition/info.ts'
    )
    const id = GameInfoId.exec(readFileSync(infoFile, 'utf8'))?.[1]
    if (!id) throw new Error(`${infoFile} declares no game id`)
    // GameUI lowers and hyphenates the id it gets, so any other id would never match its root.
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) throw new Error(`Game id ${id} cannot scope CSS`)
    return id
}

function scopeSelector(selector, scopePrefix) {
    const trimmed = selector.trim()
    if (!trimmed || trimmed.startsWith(scopePrefix)) return trimmed
    if (trimmed === ':root' || trimmed.startsWith('html') || trimmed.startsWith('body'))
        return scopePrefix
    return `${scopePrefix} ${trimmed}`
}

export function scopeGameCss(scopePrefix, isScoped) {
    return {
        postcssPlugin: 'scope-game-css-plugin',
        Rule(rule) {
            const sourceFile = (rule.source?.input?.file ?? '').replace(/\\/g, '/')
            if (!isScoped(sourceFile)) return
            if (rule.parent?.type === 'atrule' && KeyframeRules.includes(rule.parent.name)) return
            if (!rule.selectors) return
            rule.selectors = rule.selectors.map((selector) =>
                selector ? scopeSelector(selector, scopePrefix) : selector
            )
        }
    }
}

// The 18xx family library's plain stylesheets are injected by every title that ships the library,
// so each title scopes them to itself as it does its own styles.
function isFamilyStylesheet(sourceFile) {
    return (
        /\/18xx-ui\/(?:dist|src\/lib)\/.+\.css$/.test(sourceFile) && !sourceFile.includes('.svelte')
    )
}

/**
 * A game UI package's PostCSS config: Tailwind, then its title's stylesheets scoped to its table.
 *
 * @param {object} options
 * @param {URL} options.packageRootUrl The UI package's root.
 * @param {boolean} [options.family18xx] Built on the 18xx family library, styled from `src/lib/styles.css`.
 * @param {readonly string[]} [options.additionalStylesheets] Other stylesheets of the title, as path endings.
 */
export function createGameUiPostcssConfig({
    packageRootUrl,
    family18xx = false,
    additionalStylesheets = []
}) {
    const scopePrefix = `[data-game-ui="${gameUiId(fileURLToPath(packageRootUrl).replace(/[\\/]$/, ''))}"]`
    const stylesheets = [
        family18xx ? '/src/lib/styles.css' : '/src/app.css',
        ...additionalStylesheets
    ]
    const isScoped = (sourceFile) =>
        stylesheets.some((stylesheet) => sourceFile.endsWith(stylesheet)) ||
        (family18xx && isFamilyStylesheet(sourceFile))
    return { plugins: [tailwindcss(), scopeGameCss(scopePrefix, isScoped)] }
}
