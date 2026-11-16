import { describe, expect, it } from 'vitest'
import { ActionSource, assertExists, latestPlayerUndoTarget } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import { isPayDividends } from '../actions/payDividends.js'
import { isCompleteExpansion } from '../actions/endExpansion.js'
import { isAwardShare } from '../actions/awardShare.js'
import { isDeterminePlayerOrder } from '../actions/determinePlayerOrder.js'
import { BERLIN, SpaceKind, mapSpace, neighboringSpaces } from '../components/map.js'
import { OPENING_AUCTION_ORDER, RAILROADS, RailroadId } from '../components/railroads.js'
import { Table } from '../testing/table.js'
import { connectionGoalImpossible, everyRailroadConnected } from './endCheck.js'
import { buildChoices, canEnter, trackCharge } from './expansion.js'
import { planExpansion } from '../testing/expansionPlan.js'
import { directConnections, railroadIncome } from './network.js'
import type { RailroadState } from './railroadState.js'
import { drawTurnOrder, fillCup } from './turnOrder.js'

function board(changes: Partial<Record<RailroadId, Partial<RailroadState>>> = {}): RailroadState[] {
    return RAILROADS.map((railroad) => ({
        id: railroad.id,
        treasury: 100,
        owners: ['p0'],
        track: [railroad.homeSpaceId],
        ...changes[railroad.id]
    }))
}

function costs(railroads: RailroadState[], id: RailroadId, spaceIds: string[]) {
    return planExpansion(railroads, id, spaceIds)?.costs
}

describe('the board', () => {
    it('reads the printed map', () => {
        expect(mapSpace('konigsberg').city?.value).toBe(3)
        expect(mapSpace(BERLIN).hexes).toHaveLength(3)
        expect(neighboringSpaces(BERLIN).every((id) => mapSpace(id).kind === 'Approach')).toBe(true)
    })

    it('starts each railroad at the income of its home city', () => {
        const incomes = board().map((railroad) => [railroad.id, railroadIncome(railroad)])
        expect(Object.fromEntries(incomes)).toEqual({
            [RailroadId.Ostbahn]: 3,
            [RailroadId.Niederschlesische]: 2,
            [RailroadId.Saechsische]: 1,
            [RailroadId.Bayerische]: 3,
            [RailroadId.MainWeser]: 2,
            [RailroadId.Badische]: 1,
            [RailroadId.KolnMindener]: 1,
            [RailroadId.BerlinHamburger]: 1
        })
    })

    it('doubles the best city in the Main-Weser network', () => {
        const railroads = board({ [RailroadId.MainWeser]: { track: ['kassel', 'r10c10', 'koln'] } })
        expect(railroadIncome(railroads[4])).toBe(1 + 2 + 2)
    })
})

describe('expansion', () => {
    it('charges by terrain', () => {
        const railroads = board()
        expect(costs(railroads, RailroadId.Ostbahn, ['r1c43'])).toEqual([2])
        expect(costs(railroads, RailroadId.Saechsische, ['r10c22'])).toEqual([3])
        expect(costs(railroads, RailroadId.MainWeser, ['r10c10'])).toEqual([4])
    })

    it('limits track per Expansion', () => {
        const railroads = board()
        expect(
            planExpansion(railroads, RailroadId.Ostbahn, ['r1c43', 'r2c42', 'r2c40', 'r1c41'])
        ).toBeDefined()
        expect(
            planExpansion(railroads, RailroadId.Ostbahn, [
                'r1c43',
                'r2c42',
                'r2c40',
                'r1c41',
                'danzig'
            ])
        ).toBeUndefined()
        expect(
            planExpansion(railroads, RailroadId.Saechsische, ['r10c22', 'dresden'])
        ).toBeDefined()
        expect(
            planExpansion(railroads, RailroadId.Saechsische, ['r10c22', 'dresden', 'r10c26'])
        ).toBeUndefined()
    })

    it('needs each track connected to the network but not to each other', () => {
        const railroads = board()
        expect(planExpansion(railroads, RailroadId.Ostbahn, ['r1c43', 'r2c42'])).toBeDefined()
        expect(planExpansion(railroads, RailroadId.Ostbahn, ['r2c42'])).toBeUndefined()
        expect(planExpansion(railroads, RailroadId.Saechsische, ['r10c22', 'r10c18'])).toBeDefined()
    })

    it('adds a City Penalty per railroad already there, except for the Niederschlesische', () => {
        const railroads = board({
            [RailroadId.Saechsische]: { track: ['leipzig', 'r10c22'] },
            [RailroadId.Niederschlesische]: { track: ['breslau', 'r10c32', 'r10c30', 'gorlitz'] },
            [RailroadId.Bayerische]: { track: ['munchen', 'dresden'] }
        })
        expect(costs(railroads, RailroadId.Saechsische, ['dresden'])).toEqual([3 + 1])
        expect(costs(railroads, RailroadId.Niederschlesische, ['r10c26', 'dresden'])).toEqual([
            3, 3
        ])
    })

    it('keeps rural hexes to one railroad', () => {
        const railroads = board({
            [RailroadId.Niederschlesische]: { track: ['leipzig', 'r10c22'] }
        })
        expect(planExpansion(railroads, RailroadId.Saechsische, ['r10c22'])).toBeUndefined()
    })

    it('builds track a dollar cheaper for the Bayerische', () => {
        expect(costs(board(), RailroadId.Bayerische, ['augsburg', 'r17c17'])).toEqual([3, 2])
    })

    it('builds one rural track free for the Badische, the dearest one', () => {
        const railroads = board()
        expect(planExpansion(railroads, RailroadId.Badische, ['r14c10', 'r14c8'])).toEqual({
            costs: [0, 3],
            total: 3,
            freeSpaceId: 'r14c10'
        })
        expect(costs(railroads, RailroadId.Badische, ['karlsruhe'])).toEqual([3])
    })

    it('caps a Köln-Mindener Expansion at $5', () => {
        const railroads = board()
        expect(
            planExpansion(railroads, RailroadId.KolnMindener, ['dortmund', 'duisburg'])
        ).toBeDefined()
        expect(
            planExpansion(railroads, RailroadId.KolnMindener, ['dortmund', 'duisburg', 'r10c6'])
        ).toBeUndefined()
    })

    it('cannot spend more than the treasury', () => {
        const railroads = board({ [RailroadId.Ostbahn]: { treasury: 3 } })
        expect(planExpansion(railroads, RailroadId.Ostbahn, ['r1c43'])).toBeDefined()
        expect(planExpansion(railroads, RailroadId.Ostbahn, ['r1c43', 'r2c42'])).toBeUndefined()
    })

    it('allows one Berlin Approach per railroad, and reaches Berlin only through it', () => {
        const railroads = board({
            [RailroadId.BerlinHamburger]: { track: ['wittenberge', 'r5c19', 'r6c18'] }
        })
        expect(canEnter(railroads, railroads[7].track, BERLIN)).toBe(false)
        expect(
            planExpansion(railroads, RailroadId.BerlinHamburger, ['r6c20', BERLIN])
        ).toBeDefined()
        expect(
            planExpansion(railroads, RailroadId.BerlinHamburger, ['r5c21', 'r6c20'])
        ).toBeUndefined()
        railroads[7].track.push('r6c20')
        const choices = buildChoices(railroads, RailroadId.BerlinHamburger, {
            built: 1,
            spent: 2,
            freeRuralCost: 0
        })
        expect(choices).toContain(BERLIN)
        expect(choices).not.toContain('r5c21')
    })
})

describe('turn order', () => {
    it('gives one cube to the highest income and one more per rank below', () => {
        const cup = fillCup([
            { playerId: 'dave', income: 5 },
            { playerId: 'pete', income: 3 },
            { playerId: 'vince', income: 3 },
            { playerId: 'burt', income: 2 },
            { playerId: 'john', income: 1 }
        ])
        expect(cup.map(({ cubes }) => cubes)).toEqual([1, 2, 2, 3, 4])
    })

    it('draws as many cubes as players, so a player may take several turns', () => {
        const cup = fillCup([
            { playerId: 'rich', income: 9 },
            { playerId: 'poor', income: 0 }
        ])
        let calls = 0
        expect(drawTurnOrder(cup, 2, () => [0.99, 0.6][calls++])).toEqual(['poor', 'poor'])
    })
})

describe('drawing the turn order', () => {
    function passRound(table: Table) {
        for (const playerId of table.hydrated.turnSlots) {
            table.act(playerId, { type: ActionType.PassTurn })
        }
    }

    it('waits after the opening auctions for the last share’s buyer to draw', () => {
        const table = new Table(3)
        table.playInitialAuctions()
        const lastRailroadId = OPENING_AUCTION_ORDER.at(-1)
        assertExists(lastRailroadId, 'The opening sells railroads')
        const [lastBuyer] = table.hydrated.railroad(lastRailroadId).owners
        expect(table.state.machineState).toBe(MachineState.DeterminingOrder)
        expect(table.state.activePlayerIds).toEqual([lastBuyer])
        expect(table.processed.some(isDeterminePlayerOrder)).toBe(false)
        const others = table.state.players.filter((player) => player.playerId !== lastBuyer)
        for (const { playerId } of others) {
            expect(() =>
                table.act(playerId, { type: ActionType.DeterminePlayerOrder, revealsInfo: true })
            ).toThrow()
        }
        const [draw] = table.drawTurnOrder()
        expect(draw).toMatchObject({ playerId: lastBuyer, revealsInfo: true })
        expect(table.state.machineState).toBe(MachineState.ChoosingAction)
    })

    it('waits at the end of a round for the last slot’s player to draw', () => {
        const table = new Table(3)
        table.playOpening()
        const lastSlotPlayerId = table.hydrated.turnSlots.at(-1)
        passRound(table)
        expect(table.state.machineState).toBe(MachineState.DeterminingOrder)
        expect(table.state.activePlayerIds).toEqual([lastSlotPlayerId])
        expect(table.state.rounds.series).toHaveLength(1)
        table.drawTurnOrder()
        expect(table.state.rounds.series).toHaveLength(2)
        expect(table.state.machineState).toBe(MachineState.ChoosingAction)
    })

    it('must be declared as revealing the draw', () => {
        const table = new Table(3)
        table.playInitialAuctions()
        expect(() => table.act(table.active, { type: ActionType.DeterminePlayerOrder })).toThrow()
    })

    it('cannot be undone by anyone', () => {
        const table = new Table(3)
        table.playOpening()
        passRound(table)
        table.drawTurnOrder()
        for (const { playerId } of table.state.players) {
            expect(latestPlayerUndoTarget(table.processed, playerId)).toBeUndefined()
        }
    })

    it('is skipped when the game ends at the end of the round', () => {
        const table = new Table(3)
        table.playOpening()
        table.edit((state) => {
            for (const railroad of state.railroads) {
                railroad.track.push('berlin', 'hamburg')
            }
        })
        passRound(table)
        const end = table.processed.at(-1)
        expect(end).toMatchObject({
            type: ActionType.DeterminePlayerOrder,
            source: ActionSource.System
        })
        expect(table.state.machineState).toBe(MachineState.EndOfGame)
    })
})

describe('play', () => {
    it('sets up a 4-player game', () => {
        const table = new Table(4)
        expect(table.state.players.map((player) => player.cash)).toEqual([30, 30, 30, 30])
        expect(table.state.machineState).toBe(MachineState.ShareBidding)
        expect(table.state.shareAuction?.railroadId).toBe(RailroadId.Ostbahn)
    })

    it('auctions one share of each railroad in order, the buyer opening the next', () => {
        const table = new Table(3)
        const first = table.active
        table.act(first, { type: ActionType.PlaceBid, amount: 7 })
        table.act(table.active, { type: ActionType.PassBid })
        table.act(table.active, { type: ActionType.PassBid })
        expect(table.hydrated.railroad(RailroadId.Ostbahn)).toMatchObject({
            treasury: 7,
            owners: [first]
        })
        expect(table.state.shareAuction?.railroadId).toBe(RailroadId.Niederschlesische)
        expect(table.active).toBe(first)
        table.playOpening()
        expect(table.state.machineState).toBe(MachineState.ChoosingAction)
        expect(table.hydrated.turnSlots).toHaveLength(3)
        expect(table.state.rounds.series).toHaveLength(1)
    })

    it('gives an unbid share to the player who opened its auction', () => {
        const table = new Table(3)
        const opener = table.active
        table.act(opener, { type: ActionType.PassBid })
        table.act(table.active, { type: ActionType.PassBid })
        table.act(table.active, { type: ActionType.PassBid })
        expect(table.hydrated.railroad(RailroadId.Ostbahn)).toMatchObject({
            treasury: 0,
            owners: [opener]
        })
        expect(table.state.players.find((player) => player.playerId === opener)?.cash).toBe(40)
    })

    it('holds back third shares until every railroad has sold its second', () => {
        const table = new Table(3)
        table.playOpening()
        expect(table.hydrated.capitalizableRailroads()).toHaveLength(8)
        table.edit((state) => state.railroad(RailroadId.Ostbahn).owners.push('p0'))
        expect(table.hydrated.capitalizableRailroads()).not.toContain(RailroadId.Ostbahn)
    })

    function connectingTable() {
        const table = new Table(3)
        table.playOpening()
        const playerId = table.active
        table.edit((state) => {
            state.railroad(RailroadId.Saechsische).owners = [playerId, playerId]
            state.railroad(RailroadId.Saechsische).track = ['leipzig', 'r10c22']
            state.railroad(RailroadId.Saechsische).treasury = 20
            state.railroad(RailroadId.Niederschlesische).owners = [playerId]
            state.railroad(RailroadId.Niederschlesische).track = [
                'breslau',
                'r10c32',
                'r10c30',
                'gorlitz',
                'r10c26',
                'dresden',
                'r11c25'
            ]
            state.railroad(RailroadId.BerlinHamburger).owners = [playerId]
        })
        return { table, playerId }
    }

    it('pays every railroad’s dividends when two railroads first meet, double for the builder', () => {
        const { table, playerId } = connectingTable()
        const cashBefore = table.hydrated.getPlayerState(playerId).cash
        const processed = buildThenStop(table, playerId, RailroadId.Saechsische, ['dresden'])
        const payout = processed.find(isPayDividends)?.metadata
        assertExists(payout, 'Dividends are paid')
        const rate = (id: RailroadId) =>
            payout.rates.find((entry) => entry.railroadId === id)?.perShare
        expect(rate(RailroadId.Saechsische)).toBe(2 * (1 + 2))
        expect(rate(RailroadId.Niederschlesische)).toBe(2 + 1 + 2)
        expect(rate(RailroadId.BerlinHamburger)).toBe(0)
        const others = table.hydrated.railroads
            .filter(
                (railroad) =>
                    ![
                        RailroadId.Saechsische,
                        RailroadId.Niederschlesische,
                        RailroadId.BerlinHamburger
                    ].includes(railroad.id)
            )
            .filter((railroad) => railroad.owners.includes(playerId))
            .reduce((sum, railroad) => sum + railroadIncome(railroad), 0)
        expect(table.hydrated.getPlayerState(playerId).cash).toBe(cashBefore + 2 * 6 + 5 + others)
    })

    it('pays nothing when railroads meet again', () => {
        const { table, playerId } = connectingTable()
        table.edit((state) => state.railroad(RailroadId.Saechsische).track.push('chemnitz'))
        table.edit((state) => state.railroad(RailroadId.Niederschlesische).track.push('r11c27'))
        expect(directConnections(table.hydrated.railroads, RailroadId.Saechsische)).toEqual([])
        table.edit((state) => state.railroad(RailroadId.Niederschlesische).track.push('chemnitz'))
        const processed = buildThenStop(table, playerId, RailroadId.Saechsische, ['dresden'])
        expect(processed.some(isPayDividends)).toBe(false)
    })

    it('pays no dividends until the Expansion ends', () => {
        const { table, playerId } = connectingTable()
        const processed = table.act(playerId, {
            type: ActionType.BuildTrack,
            railroadId: RailroadId.Saechsische,
            spaceId: 'dresden'
        })
        expect(processed.some(isPayDividends)).toBe(false)
        expect(table.state.machineState).toBe(MachineState.Expanding)
        const ended = table.act(playerId, { type: ActionType.EndExpansion })
        expect(ended.some(isPayDividends)).toBe(true)
    })
})

describe('the end of the game', () => {
    it('is not reached at the start', () => {
        expect(everyRailroadConnected(board())).toBe(false)
        expect(connectionGoalImpossible(board({}))).toBe(false)
    })

    it('comes when every railroad meets two others', () => {
        const railroads = board()
        const hubs = ['berlin', 'hamburg']
        for (const railroad of railroads) {
            railroad.track.push(...hubs)
        }
        expect(everyRailroadConnected(railroads)).toBe(true)
    })

    it('is proven impossible when no railroad can raise or spend money', () => {
        const soldOut = { owners: ['p0', 'p1', 'p2'], treasury: 0 }
        const broke = board(Object.fromEntries(RAILROADS.map((railroad) => [railroad.id, soldOut])))
        expect(connectionGoalImpossible(broke)).toBe(true)
    })

    it('is proven impossible when only one railroad can still move', () => {
        const soldOut = { owners: ['p0', 'p1', 'p2'], treasury: 0 }
        const railroads = board(
            Object.fromEntries(RAILROADS.map((railroad) => [railroad.id, soldOut]))
        )
        railroads[0].owners = ['p0']
        expect(connectionGoalImpossible(railroads)).toBe(true)
    })

    it('is proven impossible for a stranded Ostbahn, whose home has one rural neighbour', () => {
        const soldOut = { owners: ['p0', 'p1', 'p2'], treasury: 0 }
        expect(connectionGoalImpossible(board({ [RailroadId.Ostbahn]: soldOut }))).toBe(true)
    })

    it('stays possible while a stranded railroad can still be reached', () => {
        const soldOut = { owners: ['p0', 'p1', 'p2'], treasury: 0 }
        const railroads = board({ [RailroadId.Saechsische]: soldOut })
        expect(connectionGoalImpossible(railroads)).toBe(false)
    })
})

function buildThenStop(table: Table, playerId: string, railroadId: RailroadId, spaceIds: string[]) {
    const processed = spaceIds.flatMap((spaceId) =>
        table.act(playerId, { type: ActionType.BuildTrack, railroadId, spaceId })
    )
    return table.state.machineState === MachineState.Expanding
        ? [...processed, ...table.act(playerId, { type: ActionType.EndExpansion })]
        : processed
}

describe('building track one space at a time', () => {
    function expandingTable() {
        const table = new Table(3)
        table.playOpening()
        const playerId = table.active
        table.edit((state) => {
            state.railroad(RailroadId.Saechsische).owners = [playerId]
            state.railroad(RailroadId.Saechsische).treasury = 20
            state.railroad(RailroadId.Ostbahn).owners = [playerId]
            state.railroad(RailroadId.Ostbahn).treasury = 20
        })
        return { table, playerId }
    }

    it('keeps the turn open between tracks and closes it at the track limit', () => {
        const { table, playerId } = expandingTable()
        const slot = table.hydrated.slotIndex
        table.act(playerId, {
            type: ActionType.BuildTrack,
            railroadId: RailroadId.Saechsische,
            spaceId: 'r9c21'
        })
        expect(table.state.machineState).toBe(MachineState.Expanding)
        expect(table.hydrated.slotIndex).toBe(slot)
        table.act(playerId, {
            type: ActionType.BuildTrack,
            railroadId: RailroadId.Saechsische,
            spaceId: 'r8c22'
        })
        expect(table.processed.some(isCompleteExpansion)).toBe(true)
        expect(table.state.expansion).toBeUndefined()
        expect(table.hydrated.slotIndex).toBe(slot + 1)
    })

    it('lets the player stop before the limit', () => {
        const { table, playerId } = expandingTable()
        const slot = table.hydrated.slotIndex
        table.act(playerId, {
            type: ActionType.BuildTrack,
            railroadId: RailroadId.Ostbahn,
            spaceId: 'r1c43'
        })
        table.act(playerId, { type: ActionType.EndExpansion })
        expect(table.hydrated.slotIndex).toBe(slot + 1)
        expect(table.hydrated.railroad(RailroadId.Ostbahn).track).toContain('r1c43')
    })

    it('builds for one railroad only during an Expansion', () => {
        const { table, playerId } = expandingTable()
        table.act(playerId, {
            type: ActionType.BuildTrack,
            railroadId: RailroadId.Ostbahn,
            spaceId: 'r1c43'
        })
        expect(() =>
            table.act(playerId, {
                type: ActionType.BuildTrack,
                railroadId: RailroadId.Saechsische,
                spaceId: 'r9c21'
            })
        ).toThrow()
    })

    it('frees the Badische’s dearest rural track whatever order it is built in', () => {
        const railroads = board()
        const cheapFirst = planExpansion(railroads, RailroadId.Badische, ['r14c8', 'r14c10'])
        const dearFirst = planExpansion(railroads, RailroadId.Badische, ['r14c10', 'r14c8'])
        expect(cheapFirst?.total).toBe(dearFirst?.total)
        expect(
            trackCharge(railroads, RailroadId.Badische, 'r14c10', {
                built: 0,
                spent: 0,
                freeRuralCost: 0
            })
        ).toBe(0)
    })

    it('never gives the Badische a Berlin Approach for free', () => {
        const railroads = board()
        const fresh = { built: 0, spent: 0, freeRuralCost: 0 }
        expect(mapSpace('r6c20').kind).toBe(SpaceKind.Approach)
        expect(trackCharge(railroads, RailroadId.Badische, 'r6c20', fresh)).toBe(2)
        expect(trackCharge(railroads, RailroadId.Badische, 'r14c10', fresh)).toBe(0)
    })
})

describe('an opening share nobody can bid on', () => {
    it('goes to its opener for nothing through a recorded system action', () => {
        const table = new Table(3)
        const bidder = table.active
        table.edit((state) => {
            for (const player of state.players) {
                player.cash = player.playerId === bidder ? 1 : 0
            }
        })
        table.act(bidder, { type: ActionType.PlaceBid, amount: 1 })
        const awards = table.processed.filter(isAwardShare)
        expect(awards.length).toBeGreaterThan(0)
        for (const award of awards) {
            expect(award.metadata?.sale).toMatchObject({ buyerId: bidder, price: 0 })
        }
        expect(awards[0].metadata?.sale.railroadId).toBe(RAILROADS[1].id)
    })
})
