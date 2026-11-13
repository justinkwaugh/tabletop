import { afterEach, describe, expect, it } from 'vitest'
import { flushSync } from 'svelte'
import { assertExists } from '@tabletop/common'
import {
    FIVE_DOLLAR_BONUS,
    PhaseName,
    USA_CITIES,
    USA_HEXES,
    usaCity,
    type CityId,
    type HexId,
    type RailroadId
} from '@tabletop/ride-the-rails'
import { buildState } from '@tabletop/ride-the-rails/testing'
import { disposeSessions, openSessionOn } from '$lib/testing/sessionHarness.js'
import { EMPTY_BOARD_OFFER, type BoardOffer, type OfferedHex } from '$lib/model/boardOffer.js'
import { BOARD_EXTENTS, FITTED_DESKTOP_SCALE, hexCenter } from './boardGeometry.js'
import {
    BOARD_OUTLINE_PATH,
    LARGEST_PICK_SCALE,
    buildChoice,
    chipNote,
    hexDetailPlace,
    linkChoice,
    litHexLabel,
    litHexViews,
    markView,
    pickScale,
    placeName,
    scrimPath,
    spotlightMode
} from './pickMarks.js'

const RED: RailroadId = 'railroad.red'
const BLUE: RailroadId = 'railroad.blue'
const ORANGE: RailroadId = 'railroad.orange'
const YELLOW: RailroadId = 'railroad.yellow'
const BLACK: RailroadId = 'railroad.black'

const CHICAGO: CityId = 'city.usa.chicago'
const DALLAS: CityId = 'city.usa.dallas'
const KANSAS_CITY: CityId = 'city.usa.kansas-city'
const SAINT_LOUIS: CityId = 'city.usa.saint-louis'
const NEW_YORK: HexId = 'hex.usa.6-60'
const PHILADELPHIA: HexId = 'hex.usa.7-57'

afterEach(() => disposeSessions())

function hexOf(cityId: CityId): HexId {
    return usaCity(cityId).hexId
}

function offered(hexId: HexId, extension: RailroadId[], starts: RailroadId[] = []): OfferedHex {
    return {
        hexId,
        placements: [
            ...extension.map((railroadId) => ({ railroadId, isStart: false, bonuses: [] })),
            ...starts.map((railroadId) => ({ railroadId, isStart: true, bonuses: [] }))
        ],
        marks: [],
        startOnly: extension.length === 0
    }
}

function mapIndex(hexId: HexId): number {
    return USA_HEXES.findIndex((hex) => hex.id === hexId)
}

describe('lit hexes are buttons named by place and effect (R-4.3, U-1)', () => {
    it('names a city and what pressing it does, with its marks', () => {
        const chicago = {
            ...offered(hexOf(CHICAGO), [ORANGE, BLACK]),
            marks: [{ kind: 'bonus' as const, bonusId: 'bonus.usa.chicago' as const, amount: 2 }]
        }
        expect(litHexLabel(chicago)).toBe('Chicago: place Orange or Black, $2')
        const dallas = {
            ...offered(hexOf(DALLAS), [YELLOW], [BLACK]),
            marks: [
                { kind: 'bonus' as const, bonusId: 'bonus.usa.five-dollar' as const, amount: 5 }
            ]
        }
        expect(litHexLabel(dallas)).toBe('Dallas: place Yellow or start Black, $5')
    })

    it('names a plain or mountain by the nearest city and the compass point from it', () => {
        const kansasCity = hexCenter(hexOf(KANSAS_CITY))
        const plain = hexCenter('hex.usa.8-34')
        expect(plain.y).toBeCloseTo(kansasCity.y)
        expect(plain.x).toBeGreaterThan(kansasCity.x)
        expect(placeName('hex.usa.8-34')).toBe('Plain east of Kansas City')
        for (const hex of USA_HEXES.filter((hex) => hex.terrain !== 'city')) {
            expect(placeName(hex.id)).toMatch(
                /^(Plain|Mountain) (north|south|east|west|north-east|north-west|south-east|south-west) of [A-Z]/
            )
            expect(placeName(hex.id)).not.toMatch(/row|column|\d/)
        }
    })

    it('gives a hex the same distance from two cities to the one first in the map table', () => {
        const ties = USA_HEXES.filter((hex) => hex.terrain !== 'city').flatMap((hex) => {
            const center = hexCenter(hex.id)
            const distances = USA_CITIES.map((city) => {
                const cityCenter = hexCenter(city.hexId)
                return Math.hypot(center.x - cityCenter.x, center.y - cityCenter.y)
            })
            const nearest = Math.min(...distances)
            const tied = USA_CITIES.filter((_, index) => distances[index] - nearest < 1e-6)
            return tied.length > 1 ? [{ hexId: hex.id, first: tied[0] }] : []
        })
        expect(ties.length).toBeGreaterThan(0)
        for (const tie of ties) {
            expect(placeName(tie.hexId).endsWith(` of ${tie.first.name}`)).toBe(true)
        }
    })

    it('speaks the Transcontinental and the mountain cost (R-4.3.3, R-3.2.4)', () => {
        expect(
            markView({ kind: 'bonus', bonusId: 'bonus.usa.transcontinental', amount: 12 })
        ).toEqual({ tone: 'gold', text: '$12', spoken: '$12 Transcontinental' })
        expect(markView({ kind: 'placement-limit', change: -1 })).toEqual({
            tone: 'cost',
            text: '−1',
            spoken: 'lowers the limit by 1'
        })
    })

    it('lights the offer in map order, the Tab order, and rings the picked hex heavier', async () => {
        const session = await openSessionOn(
            buildState({
                phase: PhaseName.Build,
                shares: { p1: { [RED]: 1, [BLUE]: 1 } },
                track: { [NEW_YORK]: [RED], [PHILADELPHIA]: [BLUE] }
            })
        )
        const views = litHexViews(session.boardOffer)
        expect(views.map((view) => view.hexId)).toEqual(
            session.boardOffer.lit.map((hex) => hex.hexId)
        )
        const order = views.map((view) => mapIndex(view.hexId))
        expect(order).toEqual([...order].sort((a, b) => a - b))
        expect(views.every((view) => view.ring !== 'picked')).toBe(true)

        const shared = session.boardOffer.lit.find((hex) => hex.placements.length === 2)
        assertExists(shared)
        await session.pressHex(shared.hexId)
        flushSync()
        const picked = litHexViews(session.boardOffer).filter((view) => view.ring === 'picked')
        expect(picked.map((view) => view.hexId)).toEqual([shared.hexId])
        expect(picked[0].pips).toEqual([
            { railroadId: RED, hollow: false },
            { railroadId: BLUE, hollow: false }
        ])
    })

    it('gives a hex that offers only starts the fainter start ring, with hollow pips (R-4.2)', () => {
        const views = litHexViews({
            ...EMPTY_BOARD_OFFER,
            lit: [offered(hexOf(DALLAS), [], [BLACK])]
        })
        expect(views[0].ring).toBe('start')
        expect(views[0].pips).toEqual([{ railroadId: BLACK, hollow: true }])
    })

    it("names a journey's starts and links, and keeps its picked start pressable (R-3.3.1, R-3.3.2)", () => {
        const offer: BoardOffer = {
            ...EMPTY_BOARD_OFFER,
            lit: [offered(hexOf(SAINT_LOUIS), [RED, BLUE])]
        }
        expect(litHexViews(offer, { kind: 'journey-start' })[0].label).toBe(
            'Saint Louis: start a journey with its passenger'
        )
        const extending = litHexViews(offer, {
            kind: 'journey-extend',
            startHexId: hexOf(KANSAS_CITY),
            choosingHexId: hexOf(SAINT_LOUIS)
        })
        expect(extending.map((view) => [view.hexId, view.ring, view.label])).toEqual([
            [hexOf(KANSAS_CITY), 'picked', "Kansas City: the journey's start, clear the journey"],
            [hexOf(SAINT_LOUIS), 'picked', 'Saint Louis: link by Red or Blue']
        ])
    })
})

describe('marks are sized for the view (Contract, Render ownership)', () => {
    it('keeps the fitted size when zoomed out, up to twice the board size', () => {
        expect(pickScale(FITTED_DESKTOP_SCALE)).toBe(1)
        expect(pickScale(1)).toBe(1)
        expect(pickScale(FITTED_DESKTOP_SCALE / 2)).toBeCloseTo(2)
        expect(pickScale(FITTED_DESKTOP_SCALE / 10)).toBe(LARGEST_PICK_SCALE)
    })
})

describe('the scrim, the spotlight and hex detail (Contract, Coexistence and precedence)', () => {
    const pick: BoardOffer = { ...EMPTY_BOARD_OFFER, scrim: { holes: [NEW_YORK, PHILADELPHIA] } }

    it('covers the whole board, water and margin included, with a hole per lit hex', () => {
        const { x, y, width, height } = BOARD_EXTENTS
        expect(BOARD_OUTLINE_PATH).toBe(`M${x},${y}h${width}v${height}h${-width}Z`)
        const path = scrimPath([NEW_YORK, PHILADELPHIA])
        expect(path.startsWith(BOARD_OUTLINE_PATH)).toBe(true)
        expect(path.slice(BOARD_OUTLINE_PATH.length).match(/Z/g)).toHaveLength(2)
    })

    it('dims other track with no pick, and only outlines the railroad during one', () => {
        expect(spotlightMode(EMPTY_BOARD_OFFER, undefined)).toBe('none')
        expect(spotlightMode(EMPTY_BOARD_OFFER, RED)).toBe('dim')
        expect(spotlightMode(pick, RED)).toBe('outline')
    })

    it('shows hex detail beside the hex, or in the side panel during a map pick', () => {
        expect(hexDetailPlace(EMPTY_BOARD_OFFER)).toBe('beside')
        expect(hexDetailPlace(pick)).toBe('side-panel')
    })
})

describe('the railroad popup (R-4.3.2-H1, R-3.3.2)', () => {
    const fiveDollarCity = USA_CITIES.find((city) => city.bonus === FIVE_DOLLAR_BONUS.id)
    assertExists(fiveDollarCity)

    it('says a start in an empty $5 city pays nothing, and what each placement pays', () => {
        const blackStart = { railroadId: BLACK, isStart: true, bonuses: [], supplyLeft: 6 }
        expect(chipNote({}, fiveDollarCity.hexId, blackStart)).toEqual({
            kind: 'start-uses-bonus',
            amount: 5
        })
        const redPays = {
            railroadId: RED,
            isStart: false,
            bonuses: [{ bonusId: FIVE_DOLLAR_BONUS.id, amount: 5 }],
            supplyLeft: 3
        }
        const choice = buildChoice(
            {},
            { hexId: fiveDollarCity.hexId, chips: [redPays, blackStart] }
        )
        expect(choice.title).toBe(`${fiveDollarCity.name}: which railroad?`)
        expect(choice.chips.map((chip) => chip.label)).toEqual([
            'Place Red, 3 left, pays $5',
            'Start Black, start · 6 left, pays nothing: a start uses up the $5'
        ])
    })

    it("offers each railroad of a journey's link with what the journey would pay the seat", () => {
        const choice = linkChoice({
            cityId: SAINT_LOUIS,
            hexId: hexOf(SAINT_LOUIS),
            chips: [
                { railroadId: RED, gain: 4 },
                { railroadId: BLUE, gain: 2 }
            ]
        })
        expect(choice.chips.map((chip) => chip.label)).toEqual([
            'Link by Red, you +$4',
            'Link by Blue, you +$2'
        ])
    })
})
