import { afterEach, describe, expect, it } from 'vitest'
import { flushSync } from 'svelte'
import {
    LOCOMOTIVES_PER_RAILROAD,
    PhaseName,
    RAILROAD_IDS,
    supplyOf,
    usaCity,
    type HexId
} from '@tabletop/ride-the-rails'
import { buildState } from '@tabletop/ride-the-rails/testing'
import { disposeSessions, openSessionOn } from '$lib/testing/sessionHarness.js'
import {
    ordinal,
    railroadStrip,
    romanRound,
    roundTrack,
    shownRoundNumber,
    turnOrderTrack
} from './marginTracks.js'

afterEach(() => {
    disposeSessions()
})

const NEW_YORK: HexId = usaCity('city.usa.new-york').hexId
const PITTSBURGH: HexId = usaCity('city.usa.pittsburgh').hexId
const CHICAGO: HexId = usaCity('city.usa.chicago').hexId

describe('the railroad strip', () => {
    const state = buildState({
        playerCount: 4,
        round: 2,
        phase: PhaseName.Build,
        shares: {
            p1: { 'railroad.red': 2 },
            p3: { 'railroad.red': 1, 'railroad.orange': 1 },
            p4: { 'railroad.blue': 1 }
        },
        track: {
            [NEW_YORK]: ['railroad.red'],
            [PITTSBURGH]: ['railroad.red'],
            [CHICAGO]: ['railroad.orange']
        }
    })
    const strip = railroadStrip(state)

    it('has one entry per railroad, in R-1.4 order', () => {
        expect(strip.map((entry) => entry.railroadId)).toEqual([...RAILROAD_IDS])
    })

    it('shows the supply the rules count (R-1.1, R-1.1-H1)', () => {
        for (const entry of strip) {
            expect(entry.supply).toBe(supplyOf(state, entry.railroadId))
        }
        expect(strip[0].supply).toBe(LOCOMOTIVES_PER_RAILROAD - 3 - 2)
    })

    it('counts each railroad’s track on the map', () => {
        expect(strip.map((entry) => entry.trackCount)).toEqual([2, 0, 1, 0, 0, 0])
    })

    it('lists the shareholders in turn order with their shares', () => {
        expect(strip[0].shareholders).toEqual([
            { playerId: 'p1', shares: 2 },
            { playerId: 'p3', shares: 1 }
        ])
        expect(strip[1].shareholders).toEqual([{ playerId: 'p4', shares: 1 }])
        expect(strip[3].shareholders).toEqual([])
    })

    it('marks a railroad not yet available with its round (R-1.4)', () => {
        expect(
            strip.map((entry) => [entry.railroadId, entry.available, entry.availableFromRound])
        ).toEqual([
            ['railroad.red', true, 1],
            ['railroad.blue', true, 1],
            ['railroad.orange', true, 2],
            ['railroad.yellow', false, 3],
            ['railroad.purple', false, 4],
            ['railroad.black', false, 5]
        ])
    })
})

describe('the round track', () => {
    it('shows rounds I to VI with each round’s new railroad (R-1.4)', () => {
        const track = roundTrack(buildState({ round: 5 }))
        expect(track.map((stop) => romanRound(stop.round))).toEqual([
            'I',
            'II',
            'III',
            'IV',
            'V',
            'VI'
        ])
        expect(track.map((stop) => stop.newRailroadIds)).toEqual([
            ['railroad.red', 'railroad.blue'],
            ['railroad.orange'],
            ['railroad.yellow'],
            ['railroad.purple'],
            ['railroad.black'],
            []
        ])
        expect(track.filter((stop) => stop.current).map((stop) => stop.round)).toEqual([5])
    })
})

describe('the tracks once the game ends', () => {
    it('keep round 6 on show with every railroad available (R-6.1, R-1.4)', async () => {
        const session = await openSessionOn(
            buildState({ playerCount: 3, round: 6, phase: PhaseName.Ride })
        )
        for (let seat = 0; seat < 3; seat++) {
            await session.passJourney()
            await session.waitForVisibleTransitionSettled()
            flushSync()
        }
        const state = session.gameState
        expect(state.result).toBeDefined()
        expect(state.roundManager.currentRound).toBeUndefined()
        expect(shownRoundNumber(state)).toBe(6)
        expect(railroadStrip(state).every((entry) => entry.available)).toBe(true)
        expect(
            roundTrack(state)
                .filter((stop) => stop.current)
                .map((stop) => stop.round)
        ).toEqual([6])
    })
})

describe('the turn order track', () => {
    it('follows the turn manager and shows every seat’s money (R-2.3, R-2.5)', () => {
        const state = buildState({
            playerCount: 3,
            phase: PhaseName.Ride,
            money: { p1: 12, p2: 7, p3: 30 }
        })
        state.turnManager.turnOrder = ['p2', 'p3', 'p1']
        expect(turnOrderTrack(state)).toEqual([
            { playerId: 'p2', position: 1, money: 7 },
            { playerId: 'p3', position: 2, money: 30 },
            { playerId: 'p1', position: 3, money: 12 }
        ])
    })

    it('names each place in turn order', () => {
        expect([1, 2, 3, 4, 5].map(ordinal)).toEqual(['1st', '2nd', '3rd', '4th', '5th'])
    })
})
