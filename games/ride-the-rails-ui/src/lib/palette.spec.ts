import { describe, expect, it } from 'vitest'
import { closePairs, type NamedColour } from '$lib/testing/colourMetrics.js'
import {
    appCss,
    declaredTokens,
    planPalette,
    railroadNames,
    Themes,
    tokenValue,
    type Theme
} from '$lib/testing/paletteSource.js'
import { RideTheRailsSeatPalette } from '$lib/definitions/seatPalette.js'
import { DisplayFontFamily } from '$lib/definitions/fonts.js'

const components = import.meta.glob<string>('./**/*.svelte', {
    query: '?raw',
    import: 'default',
    eager: true
})

/** The smallest CIE76 difference two colours a player must tell apart may have. */
const MinColourDifference = 30

const PaletteHues =
    'slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose'
const ColourUtilities =
    'bg|text|border(?:-[trblxyse])?|ring|outline|divide|from|via|to|fill|stroke|decoration|shadow|accent|caret|placeholder'
const NamedColours =
    'white|black|red|green|blue|yellow|orange|purple|pink|brown|gr[ae]y|silver|gold|navy|teal|maroon|olive|lime|aqua|fuchsia|cyan|magenta'

const RawColourPatterns: Record<string, RegExp> = {
    'hex literal':
        /(?<!url\(|href=["']|&)#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})(?![\w-])/g,
    'colour function': /(?<![\w-])(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch)\(/g,
    'named colour': new RegExp(
        `(?:fill|stroke|stop-color|flood-color|color|background(?:-color)?|border(?:-[a-z]+)?-color)\\s*[:=]\\s*["']?(?:${NamedColours})(?![\\w-])`,
        'g'
    ),
    'palette class': new RegExp(
        `(?<![\\w-])(?:[a-z-]+:)*(?:${ColourUtilities})-(?:(?:${PaletteHues})-\\d{2,3}|white|black)(?:\\/\\d+)?(?![\\w-])`,
        'g'
    ),
    'arbitrary colour class': new RegExp(
        `(?<![\\w-])(?:[a-z-]+:)*(?:${ColourUtilities})-\\[(?:#|rgb|hsl|oklch|color)[^\\]]*\\]`,
        'g'
    )
}

function rawColours(source: string): string[] {
    return Object.entries(RawColourPatterns).flatMap(([kind, pattern]) =>
        [...source.matchAll(pattern)].map((match) => `${kind}: ${match[0]}`)
    )
}

function railroadColours(theme: Theme): NamedColour[] {
    return railroadNames().map((name) => ({
        name: `${theme} ${name}`,
        value: tokenValue(theme, `rtr-railroad-${name}`)
    }))
}

const seatColours: NamedColour[] = Object.entries(RideTheRailsSeatPalette).map(
    ([name, values]) => ({ name: `seat ${name}`, value: values?.fill ?? '' })
)

const fixedColours: NamedColour[] = Themes.flatMap((theme) => [
    ...railroadColours(theme),
    { name: `${theme} accent`, value: tokenValue(theme, 'rtr-accent') }
])

/** Art plan, Palette: components name the title's tokens, never a raw colour. */
describe('palette', () => {
    it('declares every colour of the art plan on the title root, in both themes', () => {
        const palette = planPalette()
        expect(palette.length).toBeGreaterThan(20)
        const mismatched = palette.flatMap((colour) =>
            Themes.filter(
                (theme) =>
                    declaredTokens(theme).get(colour.token)?.toLowerCase() !==
                    colour[theme].toLowerCase()
            ).map((theme) => `${theme} --${colour.token}: ${colour[theme]}`)
        )
        expect(mismatched).toEqual([])
    })

    it('declares the same tokens in both themes', () => {
        expect([...declaredTokens('dark').keys()].sort()).toEqual(
            [...declaredTokens('light').keys()].sort()
        )
    })

    it('makes every token a Tailwind colour of the same name', () => {
        const utilities = new Set(
            [...appCss.matchAll(/^\s*--color-(rtr-[a-z-]+):\s*var\(--(rtr-[a-z-]+)\);/gm)]
                .filter(([, utility, token]) => utility === token)
                .map(([, utility]) => utility)
        )
        expect(
            [...declaredTokens('light').keys()].filter((token) => !utilities.has(token))
        ).toEqual([])
    })

    it('finds a raw colour wherever a component could write one', () => {
        const samples = [
            'fill="#c8372d"',
            "style:color={'#fff'}",
            'stroke: rgb(1 2 3)',
            'stroke="white"',
            'class="bg-red-500"',
            'class="hover:text-white"',
            'class="text-[#ad9c80]"'
        ]
        expect(samples.filter((sample) => rawColours(sample).length === 0)).toEqual([])
    })

    it('takes no token, id reference, entity or block tag for a raw colour', () => {
        const source =
            '{#each a as b}{/each} &#215; fill="url(#peaks)" href="#peaks" class="bg-rtr-panel text-rtr-ink" fill="var(--rtr-accent)"'
        expect(rawColours(source)).toEqual([])
    })

    it('no component names a raw colour', () => {
        expect(Object.keys(components).length).toBeGreaterThan(0)
        const offending = Object.entries(components).flatMap(([path, source]) =>
            rawColours(source).map((found) => `${path}: ${found}`)
        )
        expect(offending).toEqual([])
    })

    it('every token a component names is declared', () => {
        const declared = declaredTokens('light')
        const unknown = Object.entries(components).flatMap(([path, source]) =>
            [...source.matchAll(/(?:var\(--|[a-z]-)(rtr-[a-z-]+?)(?=[)\s"'/]|$)/g)]
                .filter(([, token]) => !declared.has(token))
                .map(([found]) => `${path}: ${found}`)
        )
        expect(unknown).toEqual([])
    })

    it('finds two colours too close to tell apart', () => {
        const pair = [
            { name: 'a', value: '#c8372d' },
            { name: 'b', value: '#c94030' }
        ]
        expect(closePairs(MinColourDifference, pair)).toHaveLength(1)
    })

    it.each(Themes)('keeps the railroad colours apart in the %s theme (R-1.1)', (theme) => {
        const railroads = railroadColours(theme)
        expect(railroads.map(({ name }) => name.split(' ')[1])).toEqual([
            'red',
            'blue',
            'orange',
            'yellow',
            'purple',
            'black'
        ])
        expect(closePairs(MinColourDifference, railroads)).toEqual([])
    })

    it('keeps the seat colours apart from the railroads, amber and one another (R-1.2)', () => {
        expect(seatColours).toHaveLength(5)
        expect(closePairs(MinColourDifference, seatColours, fixedColours)).toEqual([])
        expect(closePairs(MinColourDifference, seatColours)).toEqual([])
    })

    it('sets the display face in the family the font is declared under', () => {
        expect(appCss).toContain(`font-family: '${DisplayFontFamily}'`)
    })
})
