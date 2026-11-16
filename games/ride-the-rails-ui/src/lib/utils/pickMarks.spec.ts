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
import { trackSlots } from './trackLayout.js'
import {
    LARGEST_PICK_SCALE,
    buildChoice,
    chipModifiers,
    linkChoice,
    litHexLabel,
    litHexViews,
    markView,
    pickScale,
    placeName,
    scrimPath
} from './pickMarks.js'

const RED: RailroadId = 'railroad.red'
const BLUE: RailroadId = 'railroad.blue'
const ORANGE: RailroadId = 'railroad.orange'
const YELLOW: RailroadId = 'railroad.yellow'
const PURPLE: RailroadId = 'railroad.purple'
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
                /^(Plain|Mountain) ((one hex|two hexes|three hexes) )?(north|south|east|west|north-east|north-west|south-east|south-west|(north|south)-(north|south)-(east|west)|(east|west)-(north|south)-(east|west)) of [A-Z]/
            )
            expect(placeName(hex.id)).not.toMatch(/row|column|\d/)
        }
    })

    it('gives every hex a name no other hex has', () => {
        const names = USA_HEXES.map((hex) => placeName(hex.id))
        const shared = names.filter((name, index) => names.indexOf(name) !== index)
        expect(shared).toEqual([])
    })

    it('tells two plains that share a compass point apart, finer and then by distance', () => {
        // Both lie west of Rapid City: one beside it, one two hexes out.
        expect(placeName('hex.usa.3-23')).toBe('Plain one hex west of Rapid City')
        expect(placeName('hex.usa.3-21')).toBe('Plain two hexes west of Rapid City')
        // Saint Louis has two plains to its north-east; the finer compass parts them.
        expect(placeName('hex.usa.7-39')).not.toBe(placeName('hex.usa.7-41'))
        expect(placeName('hex.usa.7-39')).toMatch(/^Plain \S+ of Saint Louis$/)
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
        const views = litHexViews(session.boardOffer, session.gameState.track)
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
        const picked = litHexViews(session.boardOffer, session.gameState.track).filter(
            (view) => view.ring === 'picked'
        )
        expect(picked.map((view) => view.hexId)).toEqual([shared.hexId])
        expect(picked[0].ghosts.map((ghost) => ghost.railroadId)).toEqual([RED, BLUE])
    })

    it('gives a hex that offers only starts the start ring, with its ghost cube in the middle (R-4.2)', () => {
        const views = litHexViews(
            { ...EMPTY_BOARD_OFFER, lit: [offered(hexOf(DALLAS), [], [BLACK])] },
            {}
        )
        expect(views[0].ring).toBe('start')
        expect(views[0].ghosts).toEqual([{ ...trackSlots(hexOf(DALLAS), 1)[0], railroadId: BLACK }])
    })

    it('stands each railroad that may build as a ghost cube in the slot it would take', () => {
        const hexId = hexOf(DALLAS)
        const views = litHexViews(
            { ...EMPTY_BOARD_OFFER, lit: [offered(hexId, [RED], [BLACK])] },
            { [hexId]: [] }
        )
        expect(views[0].ghosts.map(({ railroadId, x, y }) => ({ railroadId, x, y }))).toEqual(
            trackSlots(hexId).map(({ x, y }, index) => ({ railroadId: [RED, BLACK][index], x, y }))
        )
    })

    it("names a journey's starts and links, and keeps its picked start pressable (R-3.3.1, R-3.3.2)", () => {
        const offer: BoardOffer = {
            ...EMPTY_BOARD_OFFER,
            lit: [offered(hexOf(SAINT_LOUIS), [RED, BLUE])]
        }
        expect(litHexViews(offer, {}, { kind: 'journey-start' })[0].label).toBe(
            'Saint Louis: start a journey with its passenger'
        )
        const extending = litHexViews(
            offer,
            {},
            {
                kind: 'journey-extend',
                startHexId: hexOf(KANSAS_CITY),
                choosingHexId: hexOf(SAINT_LOUIS)
            }
        )
        expect(extending.map((view) => [view.hexId, view.ring, view.label])).toEqual([
            [
                hexOf(KANSAS_CITY),
                'journey-start',
                "Kansas City: the journey's start, clear the journey"
            ],
            [hexOf(SAINT_LOUIS), 'picked', 'Saint Louis: link by Red or Blue']
        ])
        // A link's railroads already stand in the city, so no ghost cube is drawn.
        expect(extending.flatMap((view) => view.ghosts)).toEqual([])
        expect(litHexViews(offer, {}, { kind: 'journey-start' })[0].ghosts).toEqual([])
    })

    it("rings a journey's start in its own kind, never a pick's, whether a link popup is open or not", () => {
        const offer: BoardOffer = {
            ...EMPTY_BOARD_OFFER,
            lit: [offered(hexOf(SAINT_LOUIS), [RED])]
        }
        const views = litHexViews(
            offer,
            {},
            {
                kind: 'journey-extend',
                startHexId: hexOf(KANSAS_CITY),
                choosingHexId: undefined
            }
        )
        expect(views.map((view) => [view.hexId, view.ring])).toEqual([
            [hexOf(KANSAS_CITY), 'journey-start'],
            [hexOf(SAINT_LOUIS), 'lit']
        ])
    })

    it('gives each next city of a journey a chevron per railroad that links it (R-3.3.2)', () => {
        const offer: BoardOffer = {
            ...EMPTY_BOARD_OFFER,
            lit: [offered(hexOf(SAINT_LOUIS), [RED, BLUE]), offered(hexOf(DALLAS), [BLUE])]
        }
        const extending = litHexViews(
            offer,
            {},
            {
                kind: 'journey-extend',
                startHexId: hexOf(KANSAS_CITY),
                choosingHexId: undefined
            }
        )
        expect(extending.map((view) => [view.hexId, view.chevrons])).toEqual([
            [hexOf(KANSAS_CITY), []],
            [hexOf(SAINT_LOUIS), [RED, BLUE]],
            [hexOf(DALLAS), [BLUE]]
        ])
        // Only a journey's next cities carry chevrons: not its starts, nor a build.
        expect(
            litHexViews(offer, {}, { kind: 'journey-start' }).flatMap((view) => view.chevrons)
        ).toEqual([])
        expect(litHexViews(offer, {}).flatMap((view) => view.chevrons)).toEqual([])
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

describe('the scrim (Contract, Coexistence and precedence)', () => {
    it('covers the land only, never the sea, with a hole per lit hex', () => {
        const land = scrimPath([])
        const { width, height } = BOARD_EXTENTS
        expect(land).not.toContain(`h${width}v${height}`)
        const path = scrimPath([NEW_YORK, PHILADELPHIA])
        expect(path.startsWith(land)).toBe(true)
        expect(path.slice(land.length).match(/Z/g)).toHaveLength(2)
    })
})

describe('the railroad popup (U-2, R-4.3, R-3.2.4, R-3.3.2)', () => {
    const fiveDollarCity = USA_CITIES.find((city) => city.bonus === FIVE_DOLLAR_BONUS.id)
    assertExists(fiveDollarCity)
    const blackStart = { railroadId: BLACK, isStart: true, bonuses: [], supplyLeft: 6 }
    const redPays = {
        railroadId: RED,
        isStart: false,
        bonuses: [{ bonusId: FIVE_DOLLAR_BONUS.id, amount: 5 }],
        supplyLeft: 3
    }

    it('names the popup by its place, and each button by the whole choice', () => {
        const choice = buildChoice(
            {},
            { hexId: fiveDollarCity.hexId, chips: [redPays, blackStart], lowersLimit: false }
        )
        expect(choice.title).toBe(`${fiveDollarCity.name}: which railroad?`)
        expect(choice.chips.map((chip) => chip.label)).toEqual([
            'Place Red, 3 left, pays $5',
            'Start Black, 6 left, pays nothing: a start uses up the $5'
        ])
    })

    it('gives a button a bonus pill only when its placement earns one', () => {
        const choice = buildChoice(
            {},
            { hexId: fiveDollarCity.hexId, chips: [redPays, blackStart], lowersLimit: false }
        )
        expect(choice.chips.map((chip) => chip.pills)).toEqual([
            [{ tone: 'five', text: '+$5' }],
            []
        ])
    })

    it('shows no pill for a start that uses up the $5 (R-4.3.2)', () => {
        const popup = { hexId: fiveDollarCity.hexId, chips: [blackStart], lowersLimit: false }
        expect(chipModifiers({}, popup, blackStart)).toEqual({
            bonuses: [],
            transcontinental: undefined,
            startUsesBonus: 5,
            mountain: false
        })
        expect(buildChoice({}, popup).chips[0].pills).toEqual([])
        // Once a railroad stands there the $5 is gone, and the start says nothing of it.
        const taken = chipModifiers({ [fiveDollarCity.hexId]: [RED] }, popup, blackStart)
        expect(taken.startUsesBonus).toBeUndefined()
    })

    it('says what completing the Transcontinental pays, with a gold pill (R-4.3.3)', () => {
        const purpleCompletes = {
            railroadId: PURPLE,
            isStart: false,
            bonuses: [{ bonusId: 'bonus.usa.transcontinental' as const, amount: 12 }],
            supplyLeft: 22
        }
        const popup = {
            hexId: hexOf(DALLAS),
            chips: [purpleCompletes, { ...blackStart, isStart: false, supplyLeft: 2 }],
            lowersLimit: false
        }
        const choice = buildChoice({}, popup)
        expect(choice.chips[0].label).toBe(
            'Place Purple, 22 left, completes the Transcontinental: pays $12'
        )
        expect(choice.chips[0].pills).toEqual([{ tone: 'gold', text: '+$12' }])
        expect(choice.chips[1].pills).toEqual([])
    })

    it('marks every button when the hex lowers the turn’s limit (R-3.2.4)', () => {
        const mountain = USA_HEXES.find((hex) => hex.terrain === 'mountain')
        assertExists(mountain)
        const orange = { railroadId: ORANGE, isStart: false, bonuses: [], supplyLeft: 8 }
        const yellow = { railroadId: YELLOW, isStart: false, bonuses: [], supplyLeft: 17 }
        const lowers = buildChoice(
            {},
            { hexId: mountain.id, chips: [orange, yellow], lowersLimit: true }
        )
        expect(lowers.chips.map((chip) => chip.mountain)).toEqual([true, true])
        expect(lowers.chips.map((chip) => chip.label)).toEqual([
            'Place Orange, 8 left, mountain: one fewer placement this turn',
            'Place Yellow, 17 left, mountain: one fewer placement this turn'
        ])
        const already = buildChoice({}, { hexId: mountain.id, chips: [orange], lowersLimit: false })
        expect(already.chips[0]).toMatchObject({ mountain: false, label: 'Place Orange, 8 left' })
    })

    it("offers each railroad of a journey's link with what the journey would pay the seat", () => {
        const choice = linkChoice({
            cityId: SAINT_LOUIS,
            hexId: hexOf(SAINT_LOUIS),
            chips: [
                { railroadId: RED, gain: 4 },
                { railroadId: BLUE, gain: 0 }
            ]
        })
        expect(choice.chips.map((chip) => chip.label)).toEqual([
            'Link by Red, you +$4',
            'Link by Blue, you +$0'
        ])
        expect(choice.chips.map((chip) => chip.pills)).toEqual([
            [{ tone: 'coin', text: '+$4' }],
            []
        ])
    })
})
