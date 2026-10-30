import { assertExists } from '@tabletop/common'
import { describe, expect, it } from 'vitest'
import { BOARD_GRID, BoardNodeKind, PROMONTORY, type SpaceId } from '../components/board.js'
import { MAX_PRICE_INDEX, MIN_PRICE_INDEX, START_PRICE_INDEX } from '../components/priceTrack.js'
import { RAILROAD_IDS, perRailroad, type RailroadId } from '../components/railroads.js'
import { TOWN_TILE_KINDS, TOWN_TILE_KIND_IDS, TownEventKind } from '../components/townTiles.js'
import type { PromontoryPointGameState } from '../model/gameState.js'
import { isOpenTo } from '../rules/network.js'
import { pathFromHome } from '../testing/fixtures.js'
import { startGame } from '../testing/startGame.js'
import type { DividendPaid, RepairsBilled, TownEffectOutcome } from './townEffectOutcome.js'
import { TOWN_EFFECTS, townEffectAt, type TownEffectId } from './townEffects.js'

const CP = 'railroad.cp'
const UP = 'railroad.up'

const PRICE_EFFECT_IDS: TownEffectId[] = [
    'tile.price.plus-1',
    'tile.price.plus-2',
    'tile.price.plus-3',
    'tile.price.minus-1',
    'tile.price.minus-2',
    'tile.price.minus-3',
    PROMONTORY.spaceId
]

const EFFECT_IDS: TownEffectId[] = [...TOWN_TILE_KIND_IDS, PROMONTORY.spaceId]

type Holding = { money: number; shares?: Partial<Record<RailroadId, number>> }

function seat(state: PromontoryPointGameState, index: number): string {
    const playerId = state.turnManager.turnOrder[index]
    assertExists(playerId, `No seat ${index}`)
    return playerId
}

function withHoldings(
    state: PromontoryPointGameState,
    holdings: Holding[]
): PromontoryPointGameState {
    const next = structuredClone(state)
    for (const [index, { money, shares = {} }] of holdings.entries()) {
        const player = next.players.find((candidate) => candidate.playerId === seat(next, index))
        assertExists(player, `No player in seat ${index}`)
        player.money = money
        player.shares = perRailroad((railroadId) => shares[railroadId] ?? 0)
    }
    return next
}

function moneyBySeat(state: PromontoryPointGameState): number[] {
    return state.turnManager.turnOrder.map((playerId) => {
        const player = state.players.find((candidate) => candidate.playerId === playerId)
        assertExists(player, `No player ${playerId}`)
        return player.money
    })
}

function dividendPaid(outcome: TownEffectOutcome): DividendPaid {
    if (outcome.kind !== TownEventKind.Dividend) {
        throw new Error(`Expected a Dividend, got ${outcome.kind}`)
    }
    return outcome
}

function repairsBilled(outcome: TownEffectOutcome): RepairsBilled {
    if (outcome.kind !== TownEventKind.Repairs) {
        throw new Error(`Expected a Repairs, got ${outcome.kind}`)
    }
    return outcome
}

function priceChangeOf(effectId: TownEffectId): number {
    const { event } = TOWN_EFFECTS[effectId]
    if (event.kind !== TownEventKind.PriceChange) {
        throw new Error(`${effectId} does not move a price`)
    }
    return event.priceChange
}

describe('Promontory Point town effect registry', () => {
    const { state: started } = startGame({ playerCount: 4 })

    it('R-4.2: nine registrations, each keyed by its component id with its printed value and component event', () => {
        expect(Object.keys(TOWN_EFFECTS).sort()).toEqual([...EFFECT_IDS].sort())
        for (const effectId of EFFECT_IDS) {
            expect(TOWN_EFFECTS[effectId].componentId).toBe(effectId)
        }
        for (const kindId of TOWN_TILE_KIND_IDS) {
            expect(TOWN_EFFECTS[kindId].event).toEqual(TOWN_TILE_KINDS[kindId].event)
        }
        expect(TOWN_EFFECTS[PROMONTORY.spaceId].event).toEqual(PROMONTORY.event)
        expect(Object.fromEntries(EFFECT_IDS.map((id) => [id, TOWN_EFFECTS[id].printed]))).toEqual({
            'tile.price.plus-1': '+1',
            'tile.price.plus-2': '+2',
            'tile.price.plus-3': '+3',
            'tile.price.minus-1': '−1',
            'tile.price.minus-2': '−2',
            'tile.price.minus-3': '−3',
            'space.0.0': '+5',
            'tile.red.dividend': '$2 per share to every holder',
            'tile.red.hammer': '$2 per share billed to every holder'
        })
        for (const effectId of PRICE_EFFECT_IDS) {
            expect(TOWN_EFFECTS[effectId].printed).toBe(
                `${priceChangeOf(effectId) > 0 ? '+' : '−'}${Math.abs(priceChangeOf(effectId))}`
            )
        }
    })

    it('R-4.2, R-3.3: a town resolves its tile, Promontory its own effect, open country nothing', () => {
        for (const space of BOARD_GRID.spaces()) {
            const effect = townEffectAt(started, space.spaceId)
            switch (space.kind) {
                case BoardNodeKind.Town:
                    expect(effect?.componentId).toBe(started.towns[space.spaceId])
                    break
                case BoardNodeKind.Promontory:
                    expect(effect?.componentId).toBe(PROMONTORY.spaceId)
                    break
                case BoardNodeKind.Empty:
                    expect(effect).toBeUndefined()
                    break
            }
        }
    })

    it('R-4.2: a price town and Promontory move only that railroad’s price by their value', () => {
        for (const effectId of PRICE_EFFECT_IDS) {
            const state = structuredClone(started)
            const before = structuredClone(state.players)
            const outcome = TOWN_EFFECTS[effectId].resolve(state, {
                railroadId: CP,
                placingPlayerId: seat(state, 0)
            })

            const priceChange = priceChangeOf(effectId)
            expect(outcome).toEqual({
                kind: TownEventKind.PriceChange,
                railroadId: CP,
                priceChange,
                priceIndexBefore: START_PRICE_INDEX,
                priceIndexAfter: START_PRICE_INDEX + priceChange,
                capped: false
            })
            expect(state.priceIndex).toEqual({
                ...started.priceIndex,
                [CP]: START_PRICE_INDEX + priceChange
            })
            expect(state.players).toEqual(before)
        }
    })

    it('R-1.2: every price effect clamps at 25 or the last 0 and reports the cap', () => {
        for (const effectId of PRICE_EFFECT_IDS) {
            const priceChange = priceChangeOf(effectId)
            const edge = priceChange > 0 ? MAX_PRICE_INDEX : MIN_PRICE_INDEX
            const oneStepShort = edge - Math.sign(priceChange)
            for (const priceIndexBefore of [edge, oneStepShort]) {
                const state = structuredClone(started)
                state.priceIndex[UP] = priceIndexBefore
                const outcome = TOWN_EFFECTS[effectId].resolve(state, {
                    railroadId: UP,
                    placingPlayerId: seat(state, 0)
                })

                const capped = Math.abs(priceChange) > Math.abs(edge - priceIndexBefore)
                expect(outcome).toMatchObject({ priceIndexBefore, priceIndexAfter: edge, capped })
                expect(state.priceIndex[UP]).toBe(edge)
            }
        }
    })

    it('R-1.2: a price change across the five 0s counts each one, uncapped', () => {
        const state = structuredClone(started)
        state.priceIndex[CP] = 6
        const outcome = TOWN_EFFECTS['tile.price.minus-3'].resolve(state, {
            railroadId: CP,
            placingPlayerId: seat(state, 0)
        })

        expect(outcome).toMatchObject({ priceIndexBefore: 6, priceIndexAfter: 3, capped: false })
    })

    it('R-4.2: a Dividend pays every holder $2 per share, whoever placed, and leaves a non-holder untouched', () => {
        const state = withHoldings(started, [
            { money: 4, shares: { [UP]: 2 } },
            { money: 0, shares: { [CP]: 3, [UP]: 1 } },
            { money: 7, shares: { [CP]: 1 } },
            { money: 5, shares: { [CP]: 2 } }
        ])
        const priceIndex = structuredClone(state.priceIndex)
        const outcome = TOWN_EFFECTS['tile.red.dividend'].resolve(state, {
            railroadId: CP,
            placingPlayerId: seat(state, 0)
        })

        expect(moneyBySeat(state)).toEqual([4, 6, 9, 9])
        expect(dividendPaid(outcome).railroadId).toBe(CP)
        expect(byPlayer(dividendPaid(outcome).payments)).toEqual(
            byPlayer([
                { playerId: seat(state, 1), amount: 6 },
                { playerId: seat(state, 2), amount: 2 },
                { playerId: seat(state, 3), amount: 4 }
            ])
        )
        expect(state.priceIndex).toEqual(priceIndex)
        expect(state.pendingRepairs).toBeUndefined()
    })

    it('R-4.2, R-4.3: a Repairs every holder can pay is collected at once and queues no one', () => {
        const state = withHoldings(started, [
            { money: 4, shares: { [UP]: 2 } },
            { money: 6, shares: { [CP]: 3 } },
            { money: 9, shares: { [CP]: 1, [UP]: 4 } },
            { money: 2, shares: {} }
        ])
        const outcome = TOWN_EFFECTS['tile.red.hammer'].resolve(state, {
            railroadId: CP,
            placingPlayerId: seat(state, 0)
        })

        expect(moneyBySeat(state)).toEqual([4, 0, 7, 2])
        expect(repairsBilled(outcome)).toMatchObject({ railroadId: CP, debtors: [] })
        expect(byPlayer(repairsBilled(outcome).bills)).toEqual(
            byPlayer([
                { playerId: seat(state, 1), owed: 6, paid: 6 },
                { playerId: seat(state, 2), owed: 2, paid: 2 }
            ])
        )
        expect(state.pendingRepairs).toBeUndefined()
    })

    it('R-4.3-H1, R-4.3-H4: a short holder pays nothing yet and is queued with the bill fixed, the placing player first', () => {
        const state = withHoldings(started, [
            { money: 1, shares: { [UP]: 1 } },
            { money: 3, shares: { [UP]: 2 } },
            { money: 10, shares: { [UP]: 3 } },
            { money: 0, shares: { [UP]: 1 } }
        ])
        const outcome = TOWN_EFFECTS['tile.red.hammer'].resolve(state, {
            railroadId: UP,
            placingPlayerId: seat(state, 1)
        })

        expect(moneyBySeat(state)).toEqual([1, 3, 4, 0])
        const debtors = [
            { playerId: seat(state, 1), owed: 4 },
            { playerId: seat(state, 3), owed: 2 },
            { playerId: seat(state, 0), owed: 2 }
        ]
        expect(state.pendingRepairs).toEqual({ railroadId: UP, debtors })
        expect(repairsBilled(outcome).debtors).toEqual(debtors)
        expect(byPlayer(repairsBilled(outcome).bills)).toEqual(
            byPlayer([
                { playerId: seat(state, 0), owed: 2, paid: 0 },
                { playerId: seat(state, 1), owed: 4, paid: 0 },
                { playerId: seat(state, 2), owed: 6, paid: 6 },
                { playerId: seat(state, 3), owed: 2, paid: 0 }
            ])
        )
    })

    it('R-4.3-H4: with the placing player able to pay, the next short seat after it decides first', () => {
        const state = withHoldings(started, [
            { money: 0, shares: { [CP]: 1 } },
            { money: 9, shares: { [CP]: 2 } },
            { money: 1, shares: { [CP]: 1 } },
            { money: 0, shares: {} }
        ])
        TOWN_EFFECTS['tile.red.hammer'].resolve(state, {
            railroadId: CP,
            placingPlayerId: seat(state, 1)
        })

        expect(state.pendingRepairs?.debtors).toEqual([
            { playerId: seat(state, 2), owed: 2 },
            { playerId: seat(state, 0), owed: 2 }
        ])
        expect(moneyBySeat(state)).toEqual([0, 5, 1, 0])
    })

    it('R-4.2: reach sweep, each of the nine effects resolves for each of the four railroads', () => {
        for (const effectId of EFFECT_IDS) {
            for (const railroadId of RAILROAD_IDS) {
                const state = withHoldings(
                    started,
                    started.players.map(() => ({ money: 10, shares: { [railroadId]: 2 } }))
                )
                const outcome = TOWN_EFFECTS[effectId].resolve(state, {
                    railroadId,
                    placingPlayerId: seat(state, 0)
                })

                expect(outcome.kind).toBe(TOWN_EFFECTS[effectId].event.kind)
                expect(outcome.railroadId).toBe(railroadId)
                switch (outcome.kind) {
                    case TownEventKind.PriceChange:
                        expect(state.priceIndex[railroadId]).toBe(
                            START_PRICE_INDEX + priceChangeOf(effectId)
                        )
                        break
                    case TownEventKind.Dividend:
                        expect(moneyBySeat(state)).toEqual(state.players.map(() => 14))
                        break
                    case TownEventKind.Repairs:
                        expect(moneyBySeat(state)).toEqual(state.players.map(() => 6))
                        break
                }
            }
        }
    })

    it('R-3.3, R-4.2: reach sweep, every town and Promontory is reachable by every railroad from its home', () => {
        const targets: SpaceId[] = BOARD_GRID.spaces()
            .filter((space) => space.kind !== BoardNodeKind.Empty)
            .map((space) => space.spaceId)
        expect(targets).toHaveLength(49)
        for (const railroadId of RAILROAD_IDS) {
            for (const target of targets) {
                const track: PromontoryPointGameState['track'] = {}
                for (const spaceId of pathFromHome(railroadId, target)) {
                    expect(isOpenTo(track, railroadId, spaceId)).toBe(true)
                    track[spaceId] = railroadId
                }
                expect(track[target]).toBe(railroadId)
                expect(townEffectAt(started, target)).toBeDefined()
            }
        }
    })
})

function byPlayer<Entry extends { playerId: string }>(entries: Entry[]): Entry[] {
    return [...entries].sort((left, right) => left.playerId.localeCompare(right.playerId))
}
