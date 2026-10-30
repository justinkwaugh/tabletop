import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const appCss = readFileSync(new URL('../../app.css', import.meta.url), 'utf8')
const artPlan = readFileSync(new URL('../../../docs/art-plan.md', import.meta.url), 'utf8')

const svelteSources = import.meta.glob<string>('../**/*.svelte', {
    query: '?raw',
    import: 'default',
    eager: true
})
// Seat colours come from the colorizer, not the palette (art plan, "Seat colours").
const scriptSources = import.meta.glob<string>(
    ['../**/*.ts', '!../**/*.spec.ts', '!../**/*.d.ts', '!../definitions/colorizer.ts'],
    { query: '?raw', import: 'default', eager: true }
)
const components = { ...svelteSources, ...scriptSources }

const TAILWIND_HUES =
    'black|white|slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose'
const COLOUR_UTILITIES =
    'bg|text|border(?:-[trblxyse])?|ring|ring-offset|outline|divide|from|via|to|fill|stroke|decoration|shadow|accent|caret|placeholder'
const NAMED_COLOURS =
    'black|white|red|green|blue|yellow|orange|purple|gray|grey|pink|brown|gold|silver|tan'

const RAW_COLOUR_PATTERNS: Record<string, RegExp> = {
    'Tailwind palette class': new RegExp(
        `(?<![\\w-])(?:[a-z-]+:)*(?:${COLOUR_UTILITIES})-(?:${TAILWIND_HUES})(?:-\\d{2,3})?(?:\\/\\d+)?(?![\\w-])`,
        'g'
    ),
    'arbitrary colour class': new RegExp(
        `(?<![\\w-])(?:[a-z-]+:)*(?:${COLOUR_UTILITIES})-\\[(?:#|rgb|hsl|oklch|color)[^\\]]*\\]`,
        'g'
    ),
    'hex colour': /(?<![\w{&/#-])#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3,4})(?![\w-])/gi,
    'colour function': /(?<![\w.$-])(?:rgba?|hsla?|oklch|oklab|lab|lch|hwb)\(/gi,
    'named colour': new RegExp(
        `(?:fill|stroke|stop-color|flood-color|lighting-color|color|background(?:-color)?)\\s*[=:]\\s*["'{]?\\s*(?:${NAMED_COLOURS})\\b`,
        'gi'
    )
}

function rawColours(source: string): string[] {
    return Object.entries(RAW_COLOUR_PATTERNS).flatMap(([kind, pattern]) =>
        [...source.matchAll(pattern)].map((match) => `${kind}: ${match[0]}`)
    )
}

function offending(): string[] {
    return Object.entries(components).flatMap(([path, source]) =>
        rawColours(source).map((hit) => `${path}: ${hit}`)
    )
}

function cssHex(value: string): string {
    const [, hex, percent] = /^#([0-9a-f]{6})(?: at (\d+) %)?$/i.exec(value.trim()) ?? []
    expect(hex, `the art plan's value ${value}`).toBeDefined()
    const alpha =
        percent === undefined
            ? ''
            : Math.round((Number(percent) / 100) * 255)
                  .toString(16)
                  .padStart(2, '0')
    return `#${hex}${alpha}`.toLowerCase()
}

const planTokens = [
    ...artPlan.matchAll(
        /^\|\s*`--(pp-[a-z-]+)`\s*\|[^|]*\|\s*`([^`]+)`(?:\s*at\s*(\d+)\s*%)?\s*\|\s*same\s*\|/gm
    )
].map((match) => ({
    name: match[1],
    value: cssHex(match[3] === undefined ? match[2] : `${match[2]} at ${match[3]} %`)
}))

const declarations = [...appCss.matchAll(/^\s*--(pp-[a-z-]+):\s*([^;]+);/gm)].map((match) => ({
    name: match[1],
    value: match[2].trim().toLowerCase()
}))
const declaredTokens = new Set(declarations.map((declaration) => declaration.name))
const themedTokens = new Set(
    [...appCss.matchAll(/^\s*--color-(pp-[a-z-]+):\s*var\(--(pp-[a-z-]+)\)/gm)]
        .filter((match) => match[1] === match[2])
        .map((match) => match[1])
)

/** Art plan, "Palette": every colour a component names is one of the title's tokens. */
describe('palette', () => {
    it('declares the art plan’s tokens with its values', () => {
        expect(planTokens).toHaveLength(25)
        expect(declarations).toEqual(planTokens)
    })

    it('declares each token once, on the title root, so Light and Dark are the same', () => {
        const rootBlock = /^:root\s*\{([^}]*)\}/m.exec(appCss)?.[1] ?? ''
        const inRoot = [...rootBlock.matchAll(/--(pp-[a-z-]+):/g)].map((match) => match[1])
        expect(inRoot).toEqual(declarations.map((declaration) => declaration.name))
        expect(appCss).not.toMatch(/prefers-color-scheme/)
        expect(appCss).not.toMatch(/\.dark[^{]*\{[^}]*--pp-/)
    })

    it('makes every token a utility colour of the same name', () => {
        expect([...declaredTokens].filter((token) => !themedTokens.has(token))).toEqual([])
    })

    it('no component names a raw colour', () => {
        expect(Object.keys(svelteSources).length).toBeGreaterThan(0)
        expect(offending()).toEqual([])
    })

    it('every token class or variable a component uses is declared', () => {
        const unknown = Object.entries(components).flatMap(([path, source]) =>
            [
                ...source.matchAll(
                    /(?<![\w-])(?:[a-z-]+:)*(?:bg|text|border|ring|outline|fill|stroke)-(pp-[a-z-]+?)(?:\/\d+)?(?![\w-])/g
                ),
                ...source.matchAll(/var\(--(pp-[a-z-]+)\)/g)
            ]
                .filter((match) => !declaredTokens.has(match[1]))
                .map((match) => `${path}: ${match[0]}`)
        )
        expect(unknown).toEqual([])
    })

    it('the raw-colour check catches each kind and passes tokens', () => {
        const raw = [
            '<div class="bg-black">',
            '<div class="hover:border-rose-400/50">',
            '<div class="bg-[#24393C]">',
            '<circle fill="#923626" />',
            "const halo = 'rgba(0, 0, 0, 0.5)'",
            '<rect fill="red" />'
        ]
        expect(raw.filter((line) => rawColours(line).length === 0)).toEqual([])
        expect(
            rawColours(
                [
                    '<div class="bg-pp-table text-pp-text border-pp-line/50">',
                    '<circle fill="var(--pp-cp)" stroke="currentColor" />',
                    '{#each pieces as piece}<use href="#track-piece" />{/each}',
                    '<rect fill="none" />'
                ].join('\n')
            )
        ).toEqual([])
    })
})
