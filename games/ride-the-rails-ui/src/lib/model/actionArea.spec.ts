import { afterEach, describe, expect, it } from 'vitest'
import { flushSync } from 'svelte'
import { assertExists } from '@tabletop/common'
import {
    PassJourney,
    PhaseName,
    isTakeShare,
    railroadsIn,
    cityById,
    type CityId,
    type HexId,
    type RailroadId,
    type Track
} from '@tabletop/ride-the-rails'
import { buildState } from '@tabletop/ride-the-rails/testing'
import { disposeSessions, openSessionOn } from '$lib/testing/sessionHarness.js'
import {
    buildProgress,
    buildableRailroads,
    decidingPlayerId,
    endBuildingLabel,
    finalStandings,
    journeyLine,
    latestJourney,
    latestShare,
    linksAndFareText,
    mountainCost,
    mountainNote,
    placedCount,
    placedText,
    seatGains,
    seatMoney,
    sharedWinNote,
    stillToTakeShare,
    winnersHeadline
} from './actionArea.js'
import { routeText } from '$lib/utils/describeAction.js'
import type { RideTheRailsGameSession } from './session.svelte.js'

const RED: RailroadId = 'railroad.red'
const BLUE: RailroadId = 'railroad.blue'
const ORANGE: RailroadId = 'railroad.orange'
const BLACK: RailroadId = 'railroad.black'
const KANSAS_CITY: CityId = 'city.usa.kansas-city'
const SAINT_LOUIS: CityId = 'city.usa.saint-louis'
const CINCINNATI: CityId = 'city.usa.cincinnati'
const NEW_YORK: HexId = 'hex.usa.6-60'

const KANSAS_CITY_TO_CINCINNATI: HexId[] = [
    'hex.usa.8-32',
    'hex.usa.8-34',
    'hex.usa.8-36',
    'hex.usa.8-38',
    'hex.usa.8-40',
    'hex.usa.8-42',
    'hex.usa.8-44',
    'hex.usa.8-46'
]

function redLine(): Track {
    const track: Track = {}
    for (const hexId of KANSAS_CITY_TO_CINCINNATI) {
        track[hexId] = [...railroadsIn(track, hexId), RED]
    }
    return track
}

afterEach(() => {
    disposeSessions()
})

async function settled(session: RideTheRailsGameSession) {
    await session.waitForVisibleTransitionSettled()
    flushSync()
}

describe('Take a share panel (R-3.1, R-1.4, R-1.1)', () => {
    it('names the seats still to take in reverse turn order (R-2.2)', () => {
        const state = buildState({ playerCount: 4, round: 1, phase: PhaseName.TakeShare })
        expect(decidingPlayerId(state)).toBe('p4')
        expect(stillToTakeShare(state, 'p4')).toEqual(['p3', 'p2', 'p1'])
        expect(stillToTakeShare(state, 'p1')).toEqual([])
    })

    it('shows the share just taken while the next seat decides', async () => {
        const session = await openSessionOn(
            buildState({ playerCount: 4, round: 1, phase: PhaseName.TakeShare })
        )
        expect(latestShare(session.actions)).toBeUndefined()
        await session.takeShare(RED)
        await settled(session)
        const latest = latestShare(session.actions)
        expect(latest && isTakeShare(latest) && [latest.playerId, latest.railroadId]).toEqual([
            'p4',
            RED
        ])
    })
})

describe('build panel (R-3.2.1, R-3.2.4)', () => {
    it('counts placements against the limit and offers Skip before the first', () => {
        const progress = buildProgress(
            buildState({
                playerCount: 4,
                phase: PhaseName.Build,
                building: { placed: 0, usedMountain: false }
            })
        )
        assertExists(progress)
        expect(placedText(progress)).toBe('0 of 5 placed')
        expect(mountainNote(progress)).toBeUndefined()
        expect(endBuildingLabel(progress)).toBe('Skip')
    })

    it('reads "Mountain used: limit 4" after a mountain, and Done after a placement', () => {
        const progress = buildProgress(
            buildState({
                playerCount: 4,
                phase: PhaseName.Build,
                building: { placed: 3, usedMountain: true }
            })
        )
        assertExists(progress)
        expect(placedText(progress)).toBe('3 of 4 placed')
        expect(mountainNote(progress)).toBe('Mountain used: limit 4')
        expect(endBuildingLabel(progress)).toBe('Done')
    })

    it('reads the map’s mountain cost: −2 on Australia, the limit 6 once a mountain is used (R-8.2)', () => {
        const progress = buildProgress(
            buildState({
                mapId: 'map.au',
                playerCount: 3,
                phase: PhaseName.Build,
                building: { placed: 2, usedMountain: true }
            })
        )
        assertExists(progress)
        expect(placedText(progress)).toBe('2 of 6 placed')
        expect(mountainCost(progress)).toBe('−2')
        expect(mountainNote(progress)).toBe('Mountain used: limit 6')
    })

    it('has no progress outside a building turn', () => {
        expect(buildProgress(buildState({ phase: PhaseName.Ride }))).toBeUndefined()
    })

    it('lists only the railroads the builder may place now', () => {
        const state = buildState({
            playerCount: 4,
            round: 1,
            phase: PhaseName.Build,
            shares: { p1: { [RED]: 1, [BLUE]: 1 }, p2: { [BLUE]: 26 } }
        })
        expect(buildableRailroads(state, 'p1')).toEqual([RED])
        expect(
            buildableRailroads(
                buildState({
                    playerCount: 4,
                    round: 1,
                    phase: PhaseName.Build,
                    shares: { p1: { [RED]: 1, [BLUE]: 1 } },
                    track: { [NEW_YORK]: [RED] }
                }),
                'p1'
            )
        ).toEqual([RED, BLUE])
    })

    it('lists each of three railroads the builder holds, and none it does not', () => {
        const state = buildState({
            playerCount: 4,
            round: 5,
            phase: PhaseName.Build,
            shares: { p1: { [RED]: 1, [ORANGE]: 1, [BLACK]: 1 }, p2: { [BLUE]: 1 } }
        })
        expect(buildableRailroads(state, 'p1')).toEqual([RED, ORANGE, BLACK])
        expect(buildableRailroads(state, 'p2')).toEqual([BLUE])
    })

    it('counts the phone’s one-line panel as placed over the limit', () => {
        const count = (placed: number, usedMountain: boolean) => {
            const progress = buildProgress(
                buildState({
                    playerCount: 4,
                    phase: PhaseName.Build,
                    building: { placed, usedMountain }
                })
            )
            assertExists(progress)
            return placedCount(progress)
        }
        expect(count(0, false)).toBe('0/5')
        expect(count(1, true)).toBe('1/4')
    })
})

describe('journey panel (R-3.3.3, R-3.3.4, R-3.3.1)', () => {
    it('reads the route as its cities and the links with the fare', () => {
        expect(routeText([KANSAS_CITY, SAINT_LOUIS, CINCINNATI])).toBe(
            'Kansas City → Saint Louis → Cincinnati'
        )
        expect(linksAndFareText(1, 2)).toBe('1 link · fare $2')
        expect(linksAndFareText(3, 4)).toBe('3 links · fare $4')
    })

    it("gives one chip per seat a payment reaches, in turn order, the rider's with the fare", () => {
        const chips = seatGains(
            [
                { playerId: 'p3', dividends: 2, fare: 0 },
                { playerId: 'p1', dividends: 2, fare: 3 },
                { playerId: 'p2', dividends: 0, fare: 0 }
            ],
            ['p1', 'p2', 'p3']
        )
        expect(chips).toEqual([
            { playerId: 'p1', amount: 5 },
            { playerId: 'p3', amount: 2 }
        ])
    })

    it("writes the waiting line for a journey just made, with the viewer's gain", async () => {
        const session = await openSessionOn(
            buildState({
                playerCount: 3,
                round: 2,
                phase: PhaseName.Ride,
                track: redLine(),
                shares: { p1: { [RED]: 1 }, p3: { [RED]: 1 } },
                // A passenger left with a link out keeps the Ride phase going after the journey.
                passengers: [KANSAS_CITY, CINCINNATI]
            })
        )
        await session.pressHex(cityById(KANSAS_CITY).hexId)
        await session.pressHex(cityById(SAINT_LOUIS).hexId)
        await session.pressHex(cityById(CINCINNATI).hexId)
        await session.rideJourney()
        await settled(session)
        const latest = latestJourney(session.actions)
        assertExists(latest)
        expect(journeyLine(latest, 'p3')).toEqual([
            { playerId: 'p1' },
            ': Kansas City → Cincinnati, via 1 city, 2 links',
            ', fare $3',
            '; you +$2'
        ])
        expect(journeyLine(latest, 'p2')).toEqual([
            { playerId: 'p1' },
            ': Kansas City → Cincinnati, via 1 city, 2 links',
            ', fare $3'
        ])
    })
})

describe('waiting views', () => {
    it("show each seat's money in turn order (R-2.5.1)", () => {
        const state = buildState({
            playerCount: 3,
            phase: PhaseName.Build,
            money: { p1: 12, p2: 7, p3: 30 }
        })
        expect(seatMoney(state)).toEqual([
            { playerId: 'p1', money: 12 },
            { playerId: 'p2', money: 7 },
            { playerId: 'p3', money: 30 }
        ])
    })
})

describe('game end (R-6.2)', () => {
    it('ranks the final money and marks every seat tied for most as a winner, with its shares', () => {
        const state = buildState({
            playerCount: 4,
            phase: PhaseName.Ride,
            money: { p1: 143, p2: 146, p3: 146, p4: 143 },
            shares: { p2: { [BLUE]: 1, [RED]: 2 }, p3: { [RED]: 1 } }
        })
        const standings = finalStandings(state)
        expect(standings.map(({ playerId, money, winner }) => [playerId, money, winner])).toEqual([
            ['p2', 146, true],
            ['p3', 146, true],
            ['p1', 143, false],
            ['p4', 143, false]
        ])
        expect(standings[0].shares).toEqual([
            { railroadId: RED, count: 2 },
            { railroadId: BLUE, count: 1 }
        ])
        expect(sharedWinNote(2)).toBe('tied for most money: both win')
        expect(sharedWinNote(3)).toBe('tied for most money: all three win')
        expect(winnersHeadline(['Silas', 'Ezra'], 146)).toBe(
            'Silas and Ezra share the win with $146'
        )
        expect(winnersHeadline(['Ana'], 90)).toBe('Ana wins with $90')
    })

    it('ends the game once round 6’s last journey phase passes', async () => {
        const session = await openSessionOn(
            buildState({ playerCount: 3, round: 6, phase: PhaseName.Ride })
        )
        // R-3.3.1: the first seat's pass sets off the others', and the game ends in its cascade.
        await session.applyAction(session.createPlayerAction(PassJourney, {}))
        await settled(session)
        expect(session.gameState.result).toBeDefined()
    })
})
