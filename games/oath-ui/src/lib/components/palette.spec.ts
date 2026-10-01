import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const appCss = readFileSync(new URL('../../app.css', import.meta.url), 'utf8')

const components = import.meta.glob<string>('./*.svelte', {
    query: '?raw',
    import: 'default',
    eager: true
})

const RAW_COLOUR_CLASS =
    /(?<![\w-])(?:[a-z-]+:)*(?:bg|text|border(?:-[trblxy])?|ring|outline|divide|from|via|to|fill|stroke|decoration|shadow)-(?:stone|amber|rose|gray|slate|zinc|neutral|sky)-\d{2,3}(?:\/\d+)?(?![\w-])/g
const ARBITRARY_COLOUR_CLASS =
    /(?<![\w-])(?:[a-z-]+:)*(?:bg|text|border|ring|outline|fill|stroke)-\[(?:#|rgb|hsl|oklch)[^\]]*\]/g
const TOKEN_CLASS = /(?<![\w-])(?:[a-z-]+:)*(?:bg|text|border|ring|outline)-(oath-[a-z-]+?)(?:\/\d+)?(?![\w-])/g

const declaredTokens = new Set(
    [...appCss.matchAll(/^\s*--(oath-[a-z-]+):/gm)].map((match) => match[1])
)
const themedTokens = new Set(
    [...appCss.matchAll(/^\s*--color-(oath-[a-z-]+):\s*var\(--(oath-[a-z-]+)\)/gm)]
        .filter((match) => match[1] === match[2])
        .map((match) => match[1])
)

function offending(pattern: RegExp): string[] {
    return Object.entries(components).flatMap(([path, source]) =>
        [...source.matchAll(pattern)].map((match) => `${path}: ${match[0]}`)
    )
}

/** Contract, "Palette": every colour a component names is one of Oath's tokens. */
describe('palette', () => {
    it('no component names a raw stone, amber, rose or grey class', () => {
        expect(offending(RAW_COLOUR_CLASS)).toEqual([])
    })

    it('no component names an arbitrary colour class', () => {
        expect(offending(ARBITRARY_COLOUR_CLASS)).toEqual([])
    })

    it('every token is a utility colour of the same name', () => {
        expect(declaredTokens.size).toBeGreaterThan(0)
        expect([...declaredTokens].filter((token) => !themedTokens.has(token))).toEqual([])
    })

    it('every token class a component uses is declared', () => {
        const unknown = Object.entries(components).flatMap(([path, source]) =>
            [...source.matchAll(TOKEN_CLASS)]
                .filter((match) => !declaredTokens.has(match[1]))
                .map((match) => `${path}: ${match[0]}`)
        )
        expect(unknown).toEqual([])
    })

    it('every token variable a component styles with is declared', () => {
        const unknown = Object.entries(components).flatMap(([path, source]) =>
            [...source.matchAll(/var\(--(oath-[a-z-]+)\)/g)]
                .filter((match) => !declaredTokens.has(match[1]))
                .map((match) => `${path}: ${match[0]}`)
        )
        expect(unknown).toEqual([])
    })
})
