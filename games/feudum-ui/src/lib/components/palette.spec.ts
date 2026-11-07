// @vitest-environment node
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Color } from '@tabletop/common'
import { Goods, LocationKinds, RegionIds } from '@tabletop/feudum'
import { ColorblindColorizer } from '@tabletop/frontend-components'
import { describe, expect, it } from 'vitest'
import { FeudumGameColorizer } from '$lib/definitions/colorizer.js'
import { contrast, luminance, seatPaint } from '$lib/model/seatPaint.js'

const libRoot = fileURLToPath(new URL('..', import.meta.url))
const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8')
const appCss = read('../../app.css')
const contract = read('../../../docs/ui-interaction-visual-contract.md')
const artPlan = read('../../../docs/art-plan.md')

const Scanned = /\.(svelte|ts)$/
/** The colourizer is where seat colours are written; a spec may name a colour to test a scan. */
const Exempt = /(\.spec\.ts|definitions\/colorizer\.ts)$/

function sourceFiles(folder: string): string[] {
    return readdirSync(folder).flatMap((name) => {
        const path = join(folder, name)
        return statSync(path).isDirectory() ? sourceFiles(path) : [path]
    })
}

const sources = sourceFiles(libRoot)
    .filter((path) => Scanned.test(path) && !Exempt.test(path))
    .map((path) => ({ path: path.slice(libRoot.length), source: readFileSync(path, 'utf8') }))

const RawColours = [
    /#[0-9a-fA-F]{3,8}\b/g,
    /\b(?:rgba?|hsla?|oklch)\(/g,
    /(?<![\w-])(?:bg|text|border(?:-[trblxy])?|ring|outline|divide|from|via|to|fill|stroke|decoration|shadow)-(?:(?:stone|amber|rose|gray|slate|zinc|neutral|sky|red|blue|green|yellow|purple|orange|pink|indigo|teal|lime|emerald|cyan|violet|fuchsia)-\d{2,3}|white|black)(?:\/\d+)?(?![\w-])/g,
    /\b(?:fill|stroke|color|background|border-color)(?:=|:\s*)"?(?:white|black|red|blue|green|yellow|purple|gray|grey)\b/g
]
const TokenUse =
    /(?:--|(?:bg|text|border|ring|outline|fill|stroke|from|via|to)-)(feudum-[a-z-]+?)(?:\/\d+)?(?![\w{$-])/g

function rawColoursIn(source: string): string[] {
    return RawColours.flatMap((pattern) => [...source.matchAll(pattern)].map((match) => match[0]))
}

/** `:root`'s rule comes first in the file; a later one overrides a token for the dark site theme. */
const darkRule = appCss.slice(appCss.indexOf(':where(.dark *)'))
const declared = new Map(
    [
        ...appCss
            .slice(0, appCss.indexOf(':where(.dark *)'))
            .matchAll(/^\s*--(feudum-[a-z-]+):\s*([^;]+);/gm)
    ].map((match) => [match[1], match[2].trim()])
)
const themed = new Set(
    [...appCss.matchAll(/^\s*--color-(feudum-[a-z-]+):\s*var\(--(feudum-[a-z-]+)\)/gm)]
        .filter((match) => match[1] === match[2])
        .map((match) => match[1])
)
/** Fonts are declared with the palette but are not colours. */
const colourTokens = [...declared.keys()].filter((token) => !token.startsWith('feudum-font-'))

/** A first cell of backticked names; `-suffix` shares the previous name's first word. */
function namesInCell(cell: string): string[] {
    let stem = ''
    return [...cell.matchAll(/`(-?[a-z-]+)`/g)].map((match) => {
        const name = match[1]
        if (name.startsWith('-')) {
            return `${stem}${name}`
        }
        stem = name.split('-')[0]
        return name
    })
}

function tableUnder(heading: string, document: string): string[] {
    const start = document.indexOf(`\n${heading}\n`)
    const rest = document.slice(start + heading.length + 2)
    const end = rest.indexOf('\n##')
    return (end < 0 ? rest : rest.slice(0, end))
        .split('\n')
        .filter((line) => line.startsWith('| `'))
}

const SeatColors = [Color.Red, Color.Blue, Color.Yellow, Color.Green, Color.Purple]
const Colorizers = [
    { name: 'default', colorizer: new FeudumGameColorizer() },
    { name: 'colour-blind', colorizer: new ColorblindColorizer() }
]

function rgb(hex: string): number[] {
    return [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16))
}

function distance(first: string, second: string): number {
    const other = rgb(second)
    return Math.hypot(...rgb(first).map((channel, index) => channel - other[index]))
}

/** The least sRGB distance two seats, or a seat and a role, may stand apart. */
const LeastDifference = 50

/** Contract, "Palette"; S71: every colour a component names is a token, seats the colourizer's. */
describe('palette', () => {
    it('the scan catches every kind of raw colour', () => {
        const fixture = `
            <path fill="white" /><path fill="#a81c26" /><div class="bg-stone-700 text-black"></div>
            <rect stroke="rgba(0, 0, 0, 1)" /><div class="bg-[#343a40]"></div>`
        expect(rawColoursIn(fixture)).toEqual(
            expect.arrayContaining([
                'fill="white',
                '#a81c26',
                'bg-stone-700',
                'text-black',
                'rgba(',
                '#343a40'
            ])
        )
    })

    it('no component or module names a raw colour', () => {
        expect(sources.length).toBeGreaterThan(10)
        const offending = sources.flatMap(({ path, source }) =>
            rawColoursIn(source).map((raw) => `${path}: ${raw}`)
        )
        expect(offending).toEqual([])
    })

    it('every token a component uses is declared', () => {
        const unknown = sources.flatMap(({ path, source }) =>
            [...source.matchAll(TokenUse)]
                .filter((match) => !declared.has(match[1]))
                .map((match) => `${path}: ${match[0]}`)
        )
        expect(unknown).toEqual([])
    })

    it('a token named from data has one for every value', () => {
        const named = [
            ...Goods.map((good) => `feudum-good-${good}`),
            ...LocationKinds.map((kind) => `feudum-disc-${kind}`),
            ...RegionIds.map((region) => `feudum-terrain-${region}`)
        ]
        expect(named.filter((token) => !declared.has(token))).toEqual([])
    })

    it('every colour token is a utility of the same name', () => {
        expect(colourTokens.filter((token) => !themed.has(token))).toEqual([])
    })

    it('the declared set is the contract table, and the art plan agrees', () => {
        const fromTable = (rows: string[]) =>
            rows.flatMap((row) => namesInCell(row.split('|')[1])).map((name) => `feudum-${name}`)
        const inContract = fromTable(tableUnder('## Palette', contract))
        const inPlan = fromTable(tableUnder('## Palette', artPlan))
        expect(new Set(inContract)).toEqual(new Set(colourTokens))
        expect(new Set(inPlan)).toEqual(new Set(colourTokens))
    })

    it('every value is the one the art plan names', () => {
        const wrong = tableUnder('## Palette', artPlan).flatMap((row) => {
            const [, names, , light] = row.split('|')
            const values = [...light.matchAll(/`(#[0-9A-Fa-f]{6,8})`(?: at (\d+) %)?/g)].map(
                ([, hex, percent]) =>
                    percent
                        ? `${hex}${Math.round((Number(percent) / 100) * 255)
                              .toString(16)
                              .padStart(2, '0')}`.toLowerCase()
                        : hex.toLowerCase()
            )
            return namesInCell(names)
                .map((name, index) => ({ name, value: values[index] ?? values[0] }))
                .filter(({ name, value }) => declared.get(`feudum-${name}`) !== value)
                .map(
                    ({ name, value }) =>
                        `${name}: plan ${value}, css ${declared.get(`feudum-${name}`)}`
                )
        })
        expect(wrong).toEqual([])
    })

    it('surface is 92 % over a light page and 85 % over a dark one', () => {
        expect(declared.get('feudum-surface')).toBe('#221d33eb')
        expect(darkRule).toMatch(/--feudum-surface: #221d33d9;/)
    })

    describe.each(Colorizers)('seat colours under the $name colorizer', ({ colorizer }) => {
        const fills = SeatColors.map((color) => colorizer.getUiColor(color))

        it('any two seats stand apart', () => {
            const close = fills.flatMap((fill, index) =>
                fills
                    .slice(index + 1)
                    .filter((other) => distance(fill, other) < LeastDifference)
                    .map((other) => `${fill} ${other}`)
            )
            expect(close).toEqual([])
        })

        it('no seat reads as danger', () => {
            const danger = declared.get('feudum-danger') ?? ''
            expect(fills.filter((fill) => distance(fill, danger) < LeastDifference)).toEqual([])
        })

        it('only yellow sits near accent: the lit ring stands over a halo, thicker than the edge', () => {
            const accent = declared.get('feudum-accent') ?? ''
            const yellow = colorizer.getUiColor(Color.Yellow)
            const near = fills.filter((fill) => distance(fill, accent) < LeastDifference)
            expect(near).toEqual([yellow])
        })

        it('ink on a seat fill has at least 4.5:1, from the seat paint alone', () => {
            const value = (ink: string) => {
                const hex = declared.get(ink.replace('var(--', '').replace(')', ''))
                return luminance(hex ?? '')
            }
            const poor = SeatColors.filter((color) => {
                const paint = seatPaint(
                    { getPlayerUiColor: () => colorizer.getUiColor(color) },
                    'seat',
                    'A'
                )
                return contrast(luminance(paint.fill), value(paint.ink)) < 4.5
            })
            expect(poor).toEqual([])
        })
    })

    it('a seat paint is the colourizer value, never a fixed one (S71)', () => {
        const paint = seatPaint({ getPlayerUiColor: (id) => `#00${id}` }, '00ff', 'A')
        expect(paint.fill).toBe('#0000ff')
    })
})
