import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

/** The UI package's root folder, which specs read the title's own files from. */
export const packageRoot = join(fileURLToPath(import.meta.url), '../../../..')

export function packageFile(path: string): string {
    return readFileSync(join(packageRoot, path), 'utf8')
}

export const appCss = packageFile('src/app.css')
const artPlan = packageFile('docs/art-plan.md')

/** One row of the art plan's Palette table: the token and its value in each palette. */
export type PlanColour = { token: string; values: ReadonlyMap<string, string> }

/** The rows of the art plan's Palette table, read by its header's palette columns. */
export function planPalette(): PlanColour[] {
    const header = /^\| Token\s*\|\s*Meaning\s*\|(.*)\|\s*$/m.exec(artPlan)
    if (!header) throw new Error('docs/art-plan.md has no Palette table')
    const palettes = header[1].split('|').map((cell) => cell.trim().toLowerCase())
    const rows = artPlan.matchAll(/^\| `--(rtr-[a-z-]+)`\s*\|[^|]*\|(.*)\|\s*$/gm)
    return [...rows].map(([, token, cells]) => {
        const values = cells.split('|').map((cell) => /`(#[0-9A-Fa-f]+)`/.exec(cell)?.[1] ?? '')
        return {
            token,
            values: new Map(palettes.map((palette, index) => [palette, values[index] ?? '']))
        }
    })
}

function declarations(block: string): Map<string, string> {
    return new Map(
        [...block.matchAll(/^\s*--(rtr-[a-z-]+):\s*([^;]+);/gm)].map(([, name, value]) => [
            name,
            value.trim()
        ])
    )
}

// The shared values sit on `:root`, which the scope plugin rewrites to the title root; each
// palette's on `[data-rtr-palette='<name>']`, which the table carries (`utils/boardLook.ts`).
const SharedBlock = /^:root \{([^}]*)\}/m
const PaletteBlocks = /^\[data-rtr-palette='([a-z-]+)'\] \{([^}]*)\}/gm

/** The tokens every palette shares, unresolved. */
export function sharedTokens(): Map<string, string> {
    const block = SharedBlock.exec(appCss)
    if (!block) throw new Error('src/app.css declares no shared tokens')
    return declarations(block[1])
}

/** The palettes `src/app.css` declares, in order. */
export function paletteNames(): string[] {
    return [...appCss.matchAll(PaletteBlocks)].map(([, name]) => name)
}

/** The tokens one palette's own block declares, unresolved. */
export function paletteTokens(palette: string): Map<string, string> {
    const block = [...appCss.matchAll(PaletteBlocks)].find(([, name]) => name === palette)
    if (!block) throw new Error(`src/app.css declares no ${palette} palette`)
    return declarations(block[2])
}

/** Every token a table in one palette sees: the shared ones and its own. */
export function declaredTokens(palette: string): Map<string, string> {
    return new Map([...sharedTokens(), ...paletteTokens(palette)])
}

/** A token's value in one palette, following `var()` references to a colour. */
export function tokenValue(palette: string, token: string): string {
    const tokens = declaredTokens(palette)
    let value = tokens.get(token)
    for (let depth = 0; value?.startsWith('var('); depth++) {
        if (depth > tokens.size) throw new Error(`--${token} refers in a circle`)
        value = tokens.get(value.slice('var(--'.length, -1))
    }
    if (!value) throw new Error(`--${token} is not declared in the ${palette} palette`)
    return value.toLowerCase()
}

/** The railroads named by the palette, from the art plan's `--rtr-railroad-<name>` rows. */
export function railroadNames(): string[] {
    return planPalette()
        .map(({ token }) => /^rtr-railroad-([a-z]+)$/.exec(token)?.[1])
        .filter((name): name is string => name !== undefined)
}
