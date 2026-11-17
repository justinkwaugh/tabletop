import { describe, expect, it } from 'vitest'
import { MAP_IDS } from '@tabletop/ride-the-rails'
import { boardGeometry } from '$lib/utils/boardGeometry.js'
import { START_BAND_WIDTH } from '$lib/utils/cityMarks.js'
import { IMPASSABLE_LINE, impassablePath } from '$lib/utils/terrainMarks.js'
import { closePairs, contrastRatio } from '$lib/testing/colourMetrics.js'
import { paletteNames, railroadNames, tokenValue } from '$lib/testing/paletteSource.js'

// Art plan, The expansion boards: each impassable side is a red line on a pale casing, drawn in
// its own layer over the board's pieces, so a city's band or cubes never hide it.
const SOURCES = import.meta.glob<string>(
    ['./ImpassableLayer.svelte', './GroundLayer.svelte', '../Board.svelte'],
    {
        query: '?raw',
        import: 'default',
        eager: true
    }
)

function source(path: string): string {
    return SOURCES[path] ?? ''
}

/** The layer's strokes, back to front: its casing, then its line. */
function strokes(): string[] {
    return [...source('./ImpassableLayer.svelte').matchAll(/stroke="var\(--(rtr-[a-z-]+)\)"/g)].map(
        ([, token]) => token ?? ''
    )
}

/** The casing's colour in a palette, as the layer draws it. */
function casing(palette: string): string {
    const [token] = strokes()
    if (!token) throw new Error('the impassable layer draws no casing')
    return tokenValue(palette, token)
}

/** WCAG AA for the parts of a graphic a player must see: 3:1 against what is next to it. */
const MinGraphicContrast = 3

/** The smallest CIE76 difference two colours a player must tell apart may have (palette.spec). */
const MinColourDifference = 30

/**
 * No pale casing reaches 3:1 on the orange band (white is 2.79:1), and no red bright enough to
 * stand clear of the Red railroad does either; there the casing's lightness and the red's hue
 * tell them apart.
 */
const MinCasingOnOrange = 2.5

const Palettes = paletteNames()

describe('impassable sides, drawn red over the board (R-8.3, R-8.4)', () => {
    it('draws one line per printed impassable side: Canada’s 18, France’s 7, none elsewhere', () => {
        const counts = Object.fromEntries(
            MAP_IDS.map((mapId) => [
                mapId,
                impassablePath(boardGeometry(mapId)).match(/M/g)?.length ?? 0
            ])
        )
        expect(counts).toEqual({
            'map.usa': 0,
            'map.au': 0,
            'map.ca': 18,
            'map.fr': 7,
            'map.de': 0
        })
    })

    it('strokes the line in --rtr-impassable on a casing in the plains’ colour, round-ended, taking no presses', () => {
        const layer = source('./ImpassableLayer.svelte')
        expect(layer).toContain('data-impassable-sides')
        expect(strokes()).toEqual(['rtr-plain', 'rtr-impassable'])
        expect(layer).toContain('stroke-linecap="round"')
        expect(layer).toContain('pointer-events="none"')
        // The ground no longer draws them, where a band or cube would cover them; it strokes
        // nothing in their red (its long-distance mark's stop bar is filled with it).
        const ground = source('./GroundLayer.svelte')
        expect(ground).not.toMatch(/impassable(Sides|Path)|IMPASSABLE_LINE|data-impassable/)
        expect(ground).not.toContain('stroke="var(--rtr-impassable)"')
    })

    it('draws the line wider than a start band, its casing a thin rim either side', () => {
        expect(IMPASSABLE_LINE.width).toBeGreaterThan(START_BAND_WIDTH)
        expect(IMPASSABLE_LINE.casing).toBeGreaterThan(0)
        expect(IMPASSABLE_LINE.casing).toBeLessThan(IMPASSABLE_LINE.width / 2)
    })

    it('stacks the layer over the bands, cubes, lines and scrim, under the passengers, staged route, picks, flights and hit targets', () => {
        const board = source('../Board.svelte')
        const at = (layer: string) => board.indexOf(`<${layer} `)
        const impassable = at('ImpassableLayer')
        expect(impassable).toBeGreaterThan(0)
        for (const below of [
            'GroundLayer',
            'CityLayer',
            'StartCueLayer',
            'BonusLayer',
            'TrackLayer',
            'LineLayer',
            'ScrimLayer'
        ]) {
            expect(at(below), below).toBeGreaterThan(0)
            expect(at(below), `${below} under the impassable sides`).toBeLessThan(impassable)
        }
        // Every passenger, a picked journey start's grown one included, stands over the line.
        const passes = [...board.matchAll(/<PassengerLayer\b/g)].map((found) => found.index)
        expect(passes).toHaveLength(2)
        for (const pass of passes) {
            expect(pass, 'a passenger pass over the impassable sides').toBeGreaterThan(impassable)
        }
        for (const above of ['StagedRouteLayer', 'PickLayer', 'FlightLayer', 'HitLayer']) {
            expect(at(above), `${above} over the impassable sides`).toBeGreaterThan(impassable)
        }
    })

    it.each(Palettes)(
        'stands the red clear of the plains and the sea, and of its casing, in the %s palette',
        (palette) => {
            const red = tokenValue(palette, 'rtr-impassable')
            const grounds = new Map([
                ['rtr-plain', tokenValue(palette, 'rtr-plain')],
                ['rtr-sea', tokenValue(palette, 'rtr-sea')],
                ['its casing', casing(palette)]
            ])
            const weak = [...grounds]
                .map(([ground, value]) => ({ ground, ratio: contrastRatio(red, value) }))
                .filter(({ ratio }) => ratio < MinGraphicContrast)
                .map(({ ground, ratio }) => `${ground} ${ratio.toFixed(2)}:1`)
            expect(weak).toEqual([])
        }
    )

    it.each(Palettes)(
        'rims the red in pale where it runs over a black band or a Red cube, in the %s palette',
        (palette) => {
            const weak = ['rtr-railroad-black', 'rtr-railroad-red']
                .map((ground) => ({
                    ground,
                    ratio: contrastRatio(casing(palette), tokenValue(palette, ground))
                }))
                .filter(({ ratio }) => ratio < MinGraphicContrast)
                .map(({ ground, ratio }) => `${ground} ${ratio.toFixed(2)}:1`)
            expect(weak).toEqual([])
        }
    )

    it.each(Palettes)('tells the line from an orange band in the %s palette', (palette) => {
        const orange = tokenValue(palette, 'rtr-railroad-orange')
        expect(contrastRatio(casing(palette), orange)).toBeGreaterThanOrEqual(MinCasingOnOrange)
        expect(
            closePairs(
                MinColourDifference,
                [{ name: 'impassable', value: tokenValue(palette, 'rtr-impassable') }],
                [{ name: 'orange', value: orange }]
            )
        ).toEqual([])
    })

    it.each(Palettes)(
        'keeps the red apart from every railroad colour, the Red railroad above all, in the %s palette',
        (palette) => {
            const railroads = railroadNames().map((name) => ({
                name,
                value: tokenValue(palette, `rtr-railroad-${name}`)
            }))
            expect(railroads.map(({ name }) => name)).toContain('red')
            expect(
                closePairs(
                    MinColourDifference,
                    [{ name: 'impassable', value: tokenValue(palette, 'rtr-impassable') }],
                    railroads
                )
            ).toEqual([])
        }
    )
})
