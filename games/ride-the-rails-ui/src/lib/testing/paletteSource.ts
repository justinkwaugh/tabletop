import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

export type Theme = 'light' | 'dark'
export const Themes: readonly Theme[] = ['light', 'dark']

/** The UI package's root folder, which specs read the title's own files from. */
export const packageRoot = join(fileURLToPath(import.meta.url), '../../../..')

export function packageFile(path: string): string {
    return readFileSync(join(packageRoot, path), 'utf8')
}

export const appCss = packageFile('src/app.css')
const artPlan = packageFile('docs/art-plan.md')

export type PlanColour = { token: string; light: string; dark: string }

/** The rows of the art plan's Palette table: token, light value, dark value. */
export function planPalette(): PlanColour[] {
    const rows = artPlan.matchAll(
        /^\| `--(rtr-[a-z-]+)`\s*\|[^|]*\|\s*`(#[0-9A-Fa-f]+)`\s*\|\s*`(#[0-9A-Fa-f]+)`\s*\|/gm
    )
    return [...rows].map(([, token, light, dark]) => ({ token, light, dark }))
}

function declarations(block: string): Map<string, string> {
    return new Map(
        [...block.matchAll(/^\s*--(rtr-[a-z-]+):\s*([^;]+);/gm)].map(([, name, value]) => [
            name,
            value.trim()
        ])
    )
}

// The light values sit on `:root`, which the scope plugin rewrites to the title root; the dark
// values on the same root inside `@scope (.dark)`.
const ThemeBlocks: Record<Theme, RegExp> = {
    light: /^:root \{([^}]*)\}/m,
    dark: /^@scope \(\.dark\) \{\s*:root \{([^}]*)\}/m
}

/** The declared tokens of one theme, unresolved. */
export function declaredTokens(theme: Theme): Map<string, string> {
    const block = ThemeBlocks[theme].exec(appCss)
    if (!block) throw new Error(`src/app.css declares no ${theme} palette`)
    return declarations(block[1])
}

/** A token's value in one theme, following `var()` references to a colour. */
export function tokenValue(theme: Theme, token: string): string {
    const tokens = declaredTokens(theme)
    let value = tokens.get(token)
    for (let depth = 0; value?.startsWith('var('); depth++) {
        if (depth > tokens.size) throw new Error(`--${token} refers in a circle`)
        value = tokens.get(value.slice('var(--'.length, -1))
    }
    if (!value) throw new Error(`--${token} is not declared in the ${theme} palette`)
    return value.toLowerCase()
}

/** The railroads named by the palette, from the art plan's `--rtr-railroad-<name>` rows. */
export function railroadNames(): string[] {
    return planPalette()
        .map(({ token }) => /^rtr-railroad-([a-z]+)$/.exec(token)?.[1])
        .filter((name): name is string => name !== undefined)
}
