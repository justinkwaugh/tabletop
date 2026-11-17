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

    it('draws the passengers over the cubes, under the lines, picks, flights and hit targets', () => {
        // A passenger's head stands in the hex above, so it is drawn over that hex's cubes too.
        expect(at('TrackLayer')).toBeGreaterThan(0)
        expect(at('PassengerLayer')).toBeGreaterThan(at('TrackLayer'))
        expect(at('LineLayer')).toBeGreaterThan(at('PassengerLayer'))
        for (const above of ['PickLayer', 'FlightLayer', 'HitLayer']) {
            expect(at(above), above).toBeGreaterThan(at('PassengerLayer'))
        }
    })

    it('draws the lit cities’ passengers over the scrim, under the staged route and picks', () => {
        // A pick's scrim is holed at the lit hexes only, and a passenger's head stands in the hex
        // above, so a lit city's passenger is drawn above the scrim, an unlit city's under it.
        const passes = [...board.matchAll(/<PassengerLayer\b[^>]*>/g)]
        const under = passes.find((pass) => pass[0].includes('cities="unlit"'))?.index ?? -1
        const over = passes.find((pass) => pass[0].includes('cities="lit"'))?.index ?? -1
        expect(passes).toHaveLength(2)
        expect(under).toBeGreaterThan(at('TrackLayer'))
        expect(at('LineLayer')).toBeGreaterThan(under)
        expect(over).toBeGreaterThan(at('ScrimLayer'))
        for (const above of [
            'StartLegend',
            'StagedRouteLayer',
            'ImpassableLayer',
            'PickLayer',
            'FlightLayer',
            'HitLayer'
        ]) {
            expect(at(above), above).toBeGreaterThan(over)
        }
    })
})
