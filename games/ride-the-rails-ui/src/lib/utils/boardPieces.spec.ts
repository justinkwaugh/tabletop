import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushSync } from 'svelte'
import { assertExists } from '@tabletop/common'
import {
    PhaseName,
    RAILROAD_IDS,
    USA_CITIES,
    cityById,
    type CityId,
    type HexId,
    type RailroadId
} from '@tabletop/ride-the-rails'
import { buildState } from '@tabletop/ride-the-rails/testing'
import { disposeSessions, openSessionOn } from '$lib/testing/sessionHarness.js'
import type { RideTheRailsGameSession } from '$lib/model/session.svelte.js'
import {
    capacityMark,
    cityPieces,
    lastJourneyLinks,
    locomotivePieces,
    railroadStarts,
    thisTurnPlacements
} from './boardPieces.js'
import { railroadNames, railroadStyle } from './railroadStyle.js'
import { trackSlot } from './trackLayout.js'

const RED: RailroadId = 'railroad.red'
const BLUE: RailroadId = 'railroad.blue'

const CHICAGO: CityId = 'city.usa.chicago'
const KANSAS_CITY: CityId = 'city.usa.kansas-city'
const SAINT_LOUIS: CityId = 'city.usa.saint-louis'
const NEW_YORK: HexId = 'hex.usa.6-60'
const PHILADELPHIA: HexId = 'hex.usa.7-57'
const KANSAS_CITY_TO_SAINT_LOUIS: HexId[] = [
    'hex.usa.8-32',
    'hex.usa.8-34',
    'hex.usa.8-36',
    'hex.usa.8-38'
]

afterEach(() => disposeSessions())

function hexOf(cityId: CityId): HexId {
    return cityById(cityId).hexId
}

async function settled(session: RideTheRailsGameSession) {
    await session.waitForVisibleTransitionSettled()
    flushSync()
}

describe('the cities on the map (R-4.1.4, R-4.3)', () => {
    it('draws every city of the map data once, with its start colours', () => {
        const pieces = cityPieces(buildState())
        expect(pieces.map((piece) => piece.cityId)).toEqual(USA_CITIES.map((city) => city.id))
        expect(pieces.map((piece) => piece.startColours)).toEqual(
            USA_CITIES.map((city) => city.startColours)
        )
    })

    it('marks the six East Coast cities that hold one locomotive ×1 and Chicago ∞', () => {
        const pieces = cityPieces(buildState())
        const single = pieces.filter((piece) => piece.capacityMark === '×1')
        expect(single).toHaveLength(6)
        expect(single.every((piece) => cityById(piece.cityId).groups.includes('east-coast'))).toBe(
            true
        )
        expect(
            pieces.filter((piece) => piece.capacityMark === '∞').map((piece) => piece.cityId)
        ).toEqual([CHICAGO])
        expect(capacityMark(2)).toBeUndefined()
    })

    it('shows the $5 bonus as taken once the city has track (R-4.3.2)', () => {
        const bonusOf = (track: Record<string, RailroadId[]>) =>
            cityPieces(buildState({ track })).find((piece) => piece.cityId === KANSAS_CITY)?.bonus
        expect(bonusOf({})).toEqual({ kind: 'five', amount: 5, taken: false })
        expect(bonusOf({ [hexOf(KANSAS_CITY)]: [RED] })).toEqual({
            kind: 'five',
            amount: 5,
            taken: true
        })
        expect(cityPieces(buildState()).find((piece) => piece.cityId === CHICAGO)?.bonus).toEqual({
            kind: 'coin',
            text: '$2'
        })
    })

    it('gives each expansion city its printed bonus as one gold pill, Toronto’s two prices in one (R-8)', () => {
        const bonuses = (['map.au', 'map.ca', 'map.fr', 'map.de'] as const).flatMap((mapId) =>
            cityPieces(buildState({ mapId })).flatMap((piece) =>
                piece.bonus ? [[piece.name, piece.bonus]] : []
            )
        )
        expect(bonuses).toEqual([
            ['Brisbane', { kind: 'coin', text: '$20' }],
            ['Perth', { kind: 'coin', text: '$50' }],
            ['Toronto', { kind: 'coin', text: '$3/$2' }],
            ['Paris', { kind: 'coin', text: '$10' }],
            ['Berlin', { kind: 'coin', text: '$3' }]
        ])
    })

    it('marks the coast cities as the Transcontinental ends, and passengers from the state (R-4.3.3, R-3.3.1)', () => {
        const pieces = cityPieces(buildState({ passengers: [KANSAS_CITY] }))
        expect(
            pieces.filter((piece) => piece.transcontinentalEnd).map((piece) => piece.cityId)
        ).toEqual(USA_CITIES.filter((city) => city.groups.length > 0).map((city) => city.id))
        expect(pieces.filter((piece) => piece.passenger).map((piece) => piece.cityId)).toEqual([
            KANSAS_CITY
        ])
    })
})

describe('the track on the map (R-4.1, U-6)', () => {
    it('puts each locomotive in its hex slot by placement order', () => {
        const kansasCity = hexOf(KANSAS_CITY)
        const pieces = locomotivePieces({ [NEW_YORK]: [RED], [kansasCity]: [BLUE, RED] })
        expect(pieces.map((piece) => [piece.hexId, piece.railroadId, piece.slot])).toEqual(
            expect.arrayContaining([
                [NEW_YORK, RED, trackSlot(NEW_YORK, 0, 1)],
                [kansasCity, BLUE, trackSlot(kansasCity, 0, 2)],
                [kansasCity, RED, trackSlot(kansasCity, 1, 2)]
            ])
        )
        expect(pieces).toHaveLength(3)
    })

    it('draws railroads in their rule colours, never in seat colours', async () => {
        const styles = RAILROAD_IDS.map(railroadStyle)
        expect(styles.map((style) => style.fill)).toEqual(
            RAILROAD_IDS.map((id) => `var(--rtr-railroad-${id.slice('railroad.'.length)})`)
        )
        const session = await openSessionOn(buildState({ playerCount: 5 }))
        const seatColours = session.gameState.players.map((player) =>
            session.colors.getPlayerUiColor(player.playerId)
        )
        for (const style of styles) {
            expect(seatColours).not.toContain(style.fill)
        }
        expect(railroadNames([RED, BLUE, 'railroad.black'])).toBe('Red, Blue or Black')
    })
})

describe("this building turn's bars (R-3.2)", () => {
    it('marks the placements of the turn under way for its seat, and clears when it ends', async () => {
        const session = await openSessionOn(
            buildState({
                phase: PhaseName.Build,
                shares: { p1: { [RED]: 1, [BLUE]: 1 } },
                track: { [NEW_YORK]: [RED], [PHILADELPHIA]: [BLUE] }
            })
        )
        expect(thisTurnPlacements(session.gameState, session.actions)).toBeUndefined()
        const single = session.boardOffer.lit.find((hex) => hex.placements.length === 1)
        assertExists(single)
        await session.pressHex(single.hexId)
        await settled(session)
        expect(thisTurnPlacements(session.gameState, session.actions)).toMatchObject({
            playerId: 'p1',
            locomotives: [{ hexId: single.hexId, railroadId: single.placements[0].railroadId }]
        })
        await session.endBuilding()
        await settled(session)
        expect(thisTurnPlacements(session.gameState, session.actions)).toBeUndefined()
    })

    it('finds where each railroad started from the placements that record a start (R-4.2)', async () => {
        const session = await openSessionOn(
            buildState({ phase: PhaseName.Build, shares: { p1: { [RED]: 1 } } })
        )
        const start = session.boardOffer.lit.find((hex) =>
            hex.placements.some((placement) => placement.railroadId === RED && placement.isStart)
        )
        assertExists(start)
        await session.placeLocomotive(RED, start.hexId)
        await settled(session)
        expect(railroadStarts(session.actions).get(RED)).toBe(start.hexId)
    })
})

describe('the last journey (U-7)', () => {
    function riding() {
        return buildState({
            playerCount: 3,
            round: 6,
            phase: PhaseName.Ride,
            track: Object.fromEntries(KANSAS_CITY_TO_SAINT_LOUIS.map((hexId) => [hexId, [RED]])),
            shares: { p1: { [RED]: 1 }, p2: { [RED]: 1 }, p3: { [RED]: 1 } },
            passengers: [KANSAS_CITY, SAINT_LOUIS]
        })
    }

    const live = { isMyTurn: true, isViewingHistory: false }
    const watching = { isMyTurn: false, isViewingHistory: false }

    it('is not drawn for the seat now deciding, and is for a seat watching, until the next action', async () => {
        const session = await openSessionOn(riding())
        expect(lastJourneyLinks(session.actions, watching)).toEqual([])
        await session.pressHex(hexOf(KANSAS_CITY))
        await session.pressHex(hexOf(SAINT_LOUIS))
        await session.rideJourney()
        await settled(session)
        const ridden = [{ railroadId: RED, hexIds: KANSAS_CITY_TO_SAINT_LOUIS }]

        // Ben decides next: his board starts clean; every other view keeps Ada's journey.
        expect(lastJourneyLinks(session.actions, live)).toEqual([])
        expect(lastJourneyLinks(session.actions, watching)).toEqual(ridden)
        expect(session.isMyTurn).toBe(true)
        expect(session.lastJourney).toEqual([])
        session.setViewingAsNonActivePlayer(true)
        flushSync()
        expect(session.lastJourney).toEqual(ridden)
        session.setViewingAsNonActivePlayer(false)
        flushSync()

        await session.pressHex(hexOf(SAINT_LOUIS))
        await session.pressHex(hexOf(KANSAS_CITY))
        await session.rideJourney()
        await settled(session)
        expect(lastJourneyLinks(session.actions, watching)).toEqual([
            { railroadId: RED, hexIds: [...KANSAS_CITY_TO_SAINT_LOUIS].reverse() }
        ])
    })

    it("shows the displayed step's journey in History View, to the deciding seat too", async () => {
        const session = await openSessionOn(riding())
        await session.pressHex(hexOf(KANSAS_CITY))
        await session.pressHex(hexOf(SAINT_LOUIS))
        await session.rideJourney()
        await settled(session)
        await session.pressHex(hexOf(SAINT_LOUIS))
        await session.pressHex(hexOf(KANSAS_CITY))
        await session.rideJourney()
        await settled(session)
        expect(session.lastJourney).toEqual([])

        // No passenger is left, so the last seat passes by itself and the game ends (R-3.3.1);
        // one step back shows the table just after the second journey, which it draws.
        await vi.waitFor(() => expect(session.history.isDisabled()).toBe(false))
        await session.history.goToPreviousAction()
        await settled(session)
        expect(session.isViewingHistory).toBe(true)
        const back = [...KANSAS_CITY_TO_SAINT_LOUIS].reverse()
        expect(
            lastJourneyLinks(session.actions, { isMyTurn: true, isViewingHistory: true })
        ).toEqual([{ railroadId: RED, hexIds: back }])
        expect(session.lastJourney).toEqual([{ railroadId: RED, hexIds: back }])
    })
})
