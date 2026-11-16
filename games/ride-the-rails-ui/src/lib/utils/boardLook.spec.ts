import { describe, expect, it } from 'vitest'
import { USA_CITIES, USA_HEXES, type HexId } from '@tabletop/ride-the-rails'
import { appCss, paletteNames } from '$lib/testing/paletteSource.js'
import { BOARD_LOOK, hexPaint, LOOK_OPTIONS } from './boardLook.js'

const components = import.meta.glob<string>('../components/**/*.svelte', {
    query: '?raw',
    import: 'default',
    eager: true
})

function hexOf(cityName: string): HexId {
    const city = USA_CITIES.find((candidate) => candidate.name === cityName)
    if (!city) throw new Error(`No city ${cityName}`)
    return city.hexId
}

function plainHex(): HexId {
    const hex = USA_HEXES.find((candidate) => candidate.terrain === 'plain')
    if (!hex) throw new Error('No plain hex')
    return hex.id
}

function mountainHex(): HexId {
    const hex = USA_HEXES.find((candidate) => candidate.terrain === 'mountain')
    if (!hex) throw new Error('No mountain hex')
    return hex.id
}

describe('the board look', () => {
    it('picks one option for each of the twelve questions', () => {
        expect(BOARD_LOOK).toEqual({
            palette: 'mist',
            startMark: 'band',
            hexFill: 'start-cities',
            bonus: 'pill',
            piece: 'flat-square',
            passenger: 'meeple',
            startCue: 'band',
            litRailroads: 'none',
            litHex: 'hole',
            cityCentre: 'cream-inset',
            mapFrame: 'sea-line',
            journeyStart: 'ring-only'
        })
    })

    it('makes every pick one of the options drawn for it', () => {
        const questions = Object.keys(LOOK_OPTIONS)
        expect(Object.keys(BOARD_LOOK)).toEqual(questions)
        for (const [question, pick] of Object.entries(BOARD_LOOK)) {
            const options: readonly string[] =
                Object.entries(LOOK_OPTIONS).find(([name]) => name === question)?.[1] ?? []
            expect(options, question).toContain(pick)
        }
    })

    it('declares a palette block in the stylesheet for every palette option', () => {
        expect(paletteNames()).toEqual([...LOOK_OPTIONS.palette])
        for (const palette of LOOK_OPTIONS.palette) {
            expect(appCss).toContain(`[data-rtr-palette='${palette}']`)
        }
    })

    it('puts the picked palette on the table', () => {
        const table = Object.entries(components).find(([path]) =>
            path.endsWith('/GameTable.svelte')
        )?.[1]
        expect(table).toContain('data-rtr-palette={BOARD_LOOK.palette}')
    })
})

describe('hex paint', () => {
    const PLAIN = { fill: 'var(--rtr-plain)', edge: 'var(--rtr-hex-edge)', edgeWidth: 0.9 }
    const patch = (fill: string) => ({ fill, edge: 'var(--rtr-patch-edge)', edgeWidth: 1.4 })

    it('fills plains on a thin grid and mountains as pale-edged patches in every scheme', () => {
        for (const scheme of LOOK_OPTIONS.hexFill) {
            expect(hexPaint(plainHex(), scheme)).toEqual(PLAIN)
            expect(hexPaint(mountainHex(), scheme)).toEqual(patch('var(--rtr-mountain)'))
        }
    })

    it('leaves cities as plain land in the terrain scheme', () => {
        expect(hexPaint(hexOf('New York'), 'terrain')).toEqual(PLAIN)
    })

    it('greys every city hex alike in the city tint scheme', () => {
        for (const city of ['New York', 'Chicago', 'Denver', 'Omaha']) {
            expect(hexPaint(hexOf(city), 'city-tint')).toEqual(patch('var(--rtr-hex-city)'))
        }
    })

    it('lightens the cities with printed starts and sets Chicago apart', () => {
        const paint = (city: string) => hexPaint(hexOf(city), 'start-cities')
        expect(paint('New York')).toEqual(patch('var(--rtr-hex-start-city)'))
        expect(paint('Seattle')).toEqual(patch('var(--rtr-hex-start-city)'))
        expect(paint('Chicago')).toEqual(patch('var(--rtr-hex-chicago)'))
        expect(paint('Denver')).toEqual(patch('var(--rtr-hex-city)'))
        expect(paint('Omaha')).toEqual(patch('var(--rtr-hex-city)'))
    })
})
