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
    it('picks one option for each of the six questions', () => {
        expect(BOARD_LOOK).toEqual({
            palette: 'paper',
            startMark: 'ring',
            hexFill: 'city-groups',
            bonus: 'coin',
            piece: 'wood-cube',
            passenger: 'figure'
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
    it('fills plain and mountain hexes by terrain in every scheme', () => {
        for (const scheme of LOOK_OPTIONS.hexFill) {
            expect(hexPaint(plainHex(), scheme)).toEqual({ fill: 'var(--rtr-plain)' })
            expect(hexPaint(mountainHex(), scheme)).toEqual({ fill: 'var(--rtr-mountain)' })
        }
    })

    it('leaves cities as plain land in the terrain scheme', () => {
        expect(hexPaint(hexOf('New York'), 'terrain')).toEqual({ fill: 'var(--rtr-plain)' })
    })

    it('lightens every city hex with a thin rim in the city tint scheme', () => {
        for (const city of ['New York', 'Chicago', 'Denver', 'Omaha']) {
            expect(hexPaint(hexOf(city), 'city-tint')).toEqual({
                fill: 'var(--rtr-hex-city)',
                rim: 'var(--rtr-hex-city-rim)',
                rimWidth: 2.2
            })
        }
    })

    it('tints the East Coast, West Coast, Chicago and $5 cities by group', () => {
        const paint = (city: string) => hexPaint(hexOf(city), 'city-groups')
        expect(paint('New York')).toMatchObject({ fill: 'var(--rtr-hex-east)', rimWidth: 3.2 })
        expect(paint('Seattle')).toMatchObject({ fill: 'var(--rtr-hex-west)' })
        expect(paint('Chicago')).toMatchObject({ fill: 'var(--rtr-hex-chicago)' })
        expect(paint('Denver')).toMatchObject({ fill: 'var(--rtr-hex-five)' })
        expect(paint('Denver').rim).toBe('var(--rtr-hex-five-rim)')
        expect(paint('Omaha')).toEqual({
            fill: 'var(--rtr-hex-city)',
            rim: 'var(--rtr-hex-city-rim)',
            rimWidth: 2.2
        })
    })
})
