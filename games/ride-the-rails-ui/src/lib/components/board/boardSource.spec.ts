import { describe, expect, it } from 'vitest'

// Contract, Render ownership: no SVG or CSS filters, masks or endless animations on the board.
// The flight layer's animators tween the board too, so they are read with it.
const BOARD_SOURCES = import.meta.glob(
    ['./*.svelte', '../Board.svelte', '../../animators/*.ts', '!../../animators/*.spec.ts'],
    {
        query: '?raw',
        import: 'default',
        eager: true
    }
)

const FORBIDDEN: [string, RegExp][] = [
    ['an SVG filter', /<filter\b|\bfilter\s*=/],
    ['a CSS filter', /\bfilter\s*:|backdrop-filter|\b(?:drop-shadow|blur)\(/],
    ['a mask', /<mask\b|\bmask\s*=|\bmask(?:-image)?\s*:/],
    ['an SVG animation', /<animate|<set\b/],
    [
        'an endless animation',
        /infinite|repeatCount|animate-(?:spin|ping|pulse|bounce)|\brepeat\s*:\s*-1|\byoyo\b/
    ]
]

describe('the board draws without effects', () => {
    it('reads every board layer', () => {
        expect(Object.keys(BOARD_SOURCES).length).toBeGreaterThanOrEqual(10)
    })

    for (const [what, pattern] of FORBIDDEN) {
        it(`uses no ${what.replace(/^an? /, '')}`, () => {
            for (const [file, source] of Object.entries(BOARD_SOURCES)) {
                expect(String(source), `${what} in ${file}`).not.toMatch(pattern)
            }
        })
    }
})

describe('the board’s layers, back to front', () => {
    const board = String(BOARD_SOURCES['../Board.svelte'] ?? '')
    const at = (layer: string) => board.indexOf(`<${layer} `)

    const passes = [...board.matchAll(/<PassengerLayer\b[^>]*>/g)]
    const tag = (cities: string) => passes.find((found) => found[0].includes(`cities="${cities}"`))
    const pass = (cities: string) => tag(cities)?.index ?? -1

    it('draws the passengers in two passes, the unlit cities’ and then the lit cities’', () => {
        expect(passes).toHaveLength(2)
        expect(pass('unlit')).toBeGreaterThan(0)
        expect(pass('lit')).toBeGreaterThan(pass('unlit'))
    })

    it('draws both passenger passes over the cubes, the lines and the impassable sides, under the start legend, staged route, picks, flights and hit targets', () => {
        // A passenger's head stands in the hex above, so it is drawn over that hex's cubes, and
        // over an impassable side's red line where it reaches one (Caen's, across the Seine).
        for (const cities of ['unlit', 'lit']) {
            for (const below of ['TrackLayer', 'LineLayer', 'ImpassableLayer']) {
                expect(at(below), below).toBeGreaterThan(0)
                expect(pass(cities), `the ${cities} pass over ${below}`).toBeGreaterThan(at(below))
            }
            for (const above of [
                'StartLegend',
                'StagedRouteLayer',
                'PickLayer',
                'FlightLayer',
                'HitLayer'
            ]) {
                expect(at(above), `${above} over the ${cities} pass`).toBeGreaterThan(pass(cities))
            }
        }
    })

    it('draws the impassable sides over the scrim, and both passenger passes over them', () => {
        // The red line is never dimmed. A lit city's passenger is never dimmed either; an unlit
        // city's is dimmed by the scrim's own fill, which its pass lays over it in a pick.
        expect(at('ScrimLayer')).toBeGreaterThan(0)
        expect(at('ImpassableLayer')).toBeGreaterThan(at('ScrimLayer'))
        expect(pass('unlit')).toBeGreaterThan(at('ImpassableLayer'))
        expect(pass('lit')).toBeGreaterThan(at('ImpassableLayer'))
    })

    it('shades the unlit pass, and only it, with the scrim’s own fill while a pick lays the scrim', () => {
        expect(tag('unlit')?.[0]).toContain('shaded={offer.scrim !== undefined}')
        expect(tag('lit')?.[0]).not.toContain('shaded')
        const scrim = String(BOARD_SOURCES['./ScrimLayer.svelte'] ?? '')
        const figure = String(BOARD_SOURCES['./PassengerFigure.svelte'] ?? '')
        expect(scrim).toContain('fill={SCRIM_FILL}')
        expect(figure).toMatch(/<path\b[^>]*\bfill=\{SCRIM_FILL\}[^>]*\bdata-scrim-shade\b/)
    })
})
