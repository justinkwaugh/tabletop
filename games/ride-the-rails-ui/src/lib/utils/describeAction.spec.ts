import { describe, expect, it } from 'vitest'
import { ActionSource, assertExists, type GameAction } from '@tabletop/common'
import {
    ActionType,
    USA_HEXES,
    cityById,
    type EndBuilding,
    type EndGame,
    type EndRound,
    type FinishBuilding,
    type PassJourney,
    type PlaceLocomotive,
    type RideJourney,
    type SkipShare,
    type TakeShare
} from '@tabletop/ride-the-rails'
import { freshState, runAction } from '@tabletop/ride-the-rails/testing'
import { readDescription } from '$lib/testing/readDescription.js'
import { describeAction } from './describeAction.js'

const NAMES: Readonly<Record<string, string>> = { p1: 'Ana', p2: 'Ben', p3: 'Cy' }

const ACTOR = 'p1'
const OTHER_SEAT = 'p2'
const SPECTATOR = undefined

const BASE = { id: 'a1', gameId: 'g1' }
const USER = { ...BASE, source: ActionSource.User }
const SYSTEM = { ...BASE, source: ActionSource.System }

const CHICAGO_HEX = cityById('city.usa.chicago').hexId
const DENVER_HEX = cityById('city.usa.denver').hexId
const MOUNTAIN_HEX = USA_HEXES.find(({ terrain }) => terrain === 'mountain')?.id
assertExists(MOUNTAIN_HEX, 'The USA map has mountains')

function readings(action: GameAction) {
    const description = describeAction(action)
    return {
        actor: readDescription(description, ACTOR, NAMES),
        otherSeat: readDescription(description, OTHER_SEAT, NAMES),
        spectator: readDescription(description, SPECTATOR, NAMES)
    }
}

// Everything in Ride the Rails is public, so the readings differ only in "you".
function expectReadings(
    action: GameAction,
    expected: { actor: string; otherSeat: string; spectator: string }
) {
    expect(readings(action)).toEqual(expected)
}

describe('share descriptions (R-3.1)', () => {
    it('names the seat and the railroad it took', () => {
        const action: TakeShare = {
            ...USER,
            type: ActionType.TakeShare,
            playerId: ACTOR,
            railroadId: 'railroad.red',
            metadata: { shares: 1, supplyLeft: 26 }
        }
        expectReadings(action, {
            actor: 'You took Red',
            otherSeat: 'Ana took Red',
            spectator: 'Ana took Red'
        })
    })

    it('reads a processed share from the engine', () => {
        const state = freshState(3)
        const playerId = state.turnManager.currentTurn()?.playerId
        assertExists(playerId, 'Phase 1 opens a turn')
        const run = runAction(state, {
            type: ActionType.TakeShare,
            playerId,
            railroadId: 'railroad.blue'
        })
        const [taken] = run.processed
        const description = describeAction(taken)
        expect(readDescription(description, playerId, NAMES)).toBe('You took Blue')
        expect(readDescription(description, SPECTATOR, NAMES)).toBe(`${NAMES[playerId]} took Blue`)
    })

    it('reads a skipped share as that seat’s own entry (R-3.1)', () => {
        const action: SkipShare = {
            ...SYSTEM,
            type: ActionType.SkipShare,
            playerId: ACTOR,
            metadata: {
                reason: 'every-supply-empty',
                railroadIds: ['railroad.red', 'railroad.blue']
            }
        }
        expectReadings(action, {
            actor: 'You took no share: Red and Blue have none left',
            otherSeat: 'Ana took no share: Red and Blue have none left',
            spectator: 'Ana took no share: Red and Blue have none left'
        })
    })
})

describe('building descriptions (R-3.2)', () => {
    it('names a start and the bonuses its placement paid (R-3.2.5, R-4.3)', () => {
        const action: PlaceLocomotive = {
            ...USER,
            type: ActionType.PlaceLocomotive,
            playerId: ACTOR,
            railroadId: 'railroad.orange',
            hexId: CHICAGO_HEX,
            metadata: {
                isStart: true,
                bonuses: [{ bonusId: 'bonus.usa.chicago', amount: 2, cityId: 'city.usa.chicago' }]
            }
        }
        expectReadings(action, {
            actor: 'You started Orange in Chicago · Chicago $2',
            otherSeat: 'Ana started Orange in Chicago · Chicago $2',
            spectator: 'Ana started Orange in Chicago · Chicago $2'
        })
    })

    it('names a city bonus by its city and the Transcontinental by itself (R-4.3.2, R-4.3.3)', () => {
        const action: PlaceLocomotive = {
            ...USER,
            type: ActionType.PlaceLocomotive,
            playerId: ACTOR,
            railroadId: 'railroad.yellow',
            hexId: DENVER_HEX,
            metadata: {
                isStart: false,
                bonuses: [
                    { bonusId: 'bonus.usa.five-dollar', amount: 5, cityId: 'city.usa.denver' },
                    { bonusId: 'bonus.usa.transcontinental', amount: 12 }
                ]
            }
        }
        expect(readings(action).otherSeat).toBe(
            'Ana placed Yellow in Denver · Denver $5 · Transcontinental $12'
        )
    })

    it('places in a mountain hex without a bonus', () => {
        const action: PlaceLocomotive = {
            ...USER,
            type: ActionType.PlaceLocomotive,
            playerId: ACTOR,
            railroadId: 'railroad.red',
            hexId: MOUNTAIN_HEX,
            metadata: { isStart: false, bonuses: [] }
        }
        expectReadings(action, {
            actor: 'You placed Red in a mountain hex',
            otherSeat: 'Ana placed Red in a mountain hex',
            spectator: 'Ana placed Red in a mountain hex'
        })
    })

    it('reads Done building with the placements made (R-3.2.1)', () => {
        const action: EndBuilding = {
            ...USER,
            type: ActionType.EndBuilding,
            playerId: ACTOR,
            metadata: { placed: 2 }
        }
        expectReadings(action, {
            actor: 'You ended building · 2 placed',
            otherSeat: 'Ana ended building · 2 placed',
            spectator: 'Ana ended building · 2 placed'
        })
        const nothing: EndBuilding = { ...action, metadata: { placed: 0 } }
        expect(readings(nothing).spectator).toBe('Ana ended building · nothing placed')
    })

    it('names why a building turn finished by itself, unless it used up its placements (R-3.2.3, R-3.2.4)', () => {
        const limit: FinishBuilding = {
            ...SYSTEM,
            type: ActionType.FinishBuilding,
            playerId: ACTOR,
            metadata: { reason: 'limit', placed: 5 }
        }
        expectReadings(limit, {
            actor: 'You finished building · 5 placed',
            otherSeat: 'Ana finished building · 5 placed',
            spectator: 'Ana finished building · 5 placed'
        })
        const stuck: FinishBuilding = { ...limit, metadata: { reason: 'nothing-legal', placed: 1 } }
        expect(readings(stuck).spectator).toBe(
            'Ana finished building · 1 placed · no legal placement left'
        )
    })
})

describe('riding descriptions (R-3.3)', () => {
    const journey: RideJourney = {
        ...USER,
        type: ActionType.RideJourney,
        playerId: ACTOR,
        links: [],
        metadata: {
            startCityId: 'city.usa.chicago',
            endCityId: 'city.usa.denver',
            cityIds: ['city.usa.chicago', 'city.usa.kansas-city', 'city.usa.denver'],
            linksPerRailroad: { 'railroad.blue': 1, 'railroad.red': 2 },
            payments: [
                { playerId: 'p1', dividends: 2, fare: 4 },
                { playerId: 'p2', dividends: 3, fare: 0 },
                { playerId: 'p3', dividends: 0, fare: 0 }
            ]
        }
    }

    it('reads the cities, links per railroad, the fare and each seat’s dividends (R-3.3.4, R-3.3.5)', () => {
        expectReadings(journey, {
            actor: 'You made a journey: Chicago → Denver, via 1 city · fare $4 · you +$2 · Ben +$3',
            otherSeat:
                'Ana made a journey: Chicago → Denver, via 1 city · fare $4 · Ana +$2 · you +$3',
            spectator:
                'Ana made a journey: Chicago → Denver, via 1 city · fare $4 · Ana +$2 · Ben +$3'
        })
    })

    it('reads a pass with its reason (R-3.3.1)', () => {
        const action: PassJourney = { ...USER, type: ActionType.PassJourney, playerId: ACTOR }
        expectReadings(action, {
            actor: 'You passed: no journey was possible',
            otherSeat: 'Ana passed: no journey was possible',
            spectator: 'Ana passed: no journey was possible'
        })
    })
})

describe('end of round and game descriptions (R-2.5, R-6.2)', () => {
    it('reads the new order with each seat’s money and the railroad made available (R-2.5)', () => {
        const action: EndRound = {
            ...SYSTEM,
            type: ActionType.EndRound,
            metadata: {
                round: 1,
                turnOrder: ['p2', 'p3', 'p1'],
                money: [
                    { playerId: 'p2', money: 3 },
                    { playerId: 'p3', money: 6 },
                    { playerId: 'p1', money: 9 }
                ],
                railroadId: 'railroad.orange'
            }
        }
        expectReadings(action, {
            actor: 'Round 1 ended · new order: Ben $3, Cy $6, you $9 · Orange is now available',
            otherSeat: 'Round 1 ended · new order: you $3, Cy $6, Ana $9 · Orange is now available',
            spectator: 'Round 1 ended · new order: Ben $3, Cy $6, Ana $9 · Orange is now available'
        })
    })

    it('names no railroad after round 5, when none is left to add (R-2.5)', () => {
        const action: EndRound = {
            ...SYSTEM,
            type: ActionType.EndRound,
            metadata: {
                round: 5,
                turnOrder: ['p2', 'p1'],
                money: [
                    { playerId: 'p2', money: 20 },
                    { playerId: 'p1', money: 24 }
                ]
            }
        }
        expect(readings(action).spectator).toBe('Round 5 ended · new order: Ben $20, Ana $24')
    })

    it('reads the final money, richest first, and the winner (R-6.2)', () => {
        const action: EndGame = {
            ...SYSTEM,
            type: ActionType.EndGame,
            metadata: {
                money: [
                    { playerId: 'p2', money: 30 },
                    { playerId: 'p1', money: 41 },
                    { playerId: 'p3', money: 35 }
                ],
                winningPlayerIds: ['p1']
            }
        }
        expectReadings(action, {
            actor: 'Game over: you $41, Cy $35, Ben $30 · winner: you',
            otherSeat: 'Game over: Ana $41, Cy $35, you $30 · winner: Ana',
            spectator: 'Game over: Ana $41, Cy $35, Ben $30 · winner: Ana'
        })
    })

    it('names every seat tied for the most money as a winner (R-6.2)', () => {
        const action: EndGame = {
            ...SYSTEM,
            type: ActionType.EndGame,
            metadata: {
                money: [
                    { playerId: 'p1', money: 40 },
                    { playerId: 'p2', money: 40 },
                    { playerId: 'p3', money: 12 }
                ],
                winningPlayerIds: ['p1', 'p2']
            }
        }
        expectReadings(action, {
            actor: 'Game over: you $40, Ben $40, Cy $12 · winners: you and Ben',
            otherSeat: 'Game over: Ana $40, you $40, Cy $12 · winners: Ana and you',
            spectator: 'Game over: Ana $40, Ben $40, Cy $12 · winners: Ana and Ben'
        })
    })
})
