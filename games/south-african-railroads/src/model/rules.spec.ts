import { describe, expect, it } from 'vitest'
import {
    ActionSource,
    GameEngine,
    GameResult,
    MachineContext,
    PlayerStatus,
    assertExists,
    type GameAction
} from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { Definition } from '../definition/definition.js'
import { SarRuntime } from '../definition/runtime.js'
import { MachineState } from '../definition/states.js'
import { MapId, RailroadId, SettlementKind } from '../maps/types.js'
import { sarMap } from '../maps/maps.js'
import { ACTION_BOXES, ActionBox, boxCapacity } from './actionBoxes.js'
import type { HydratedSarGameState, SarGameState } from './gameState.js'
import { HydratedChooseAction } from '../actions/chooseAction.js'
import { HydratedDelegateBuild } from '../actions/delegateBuild.js'
import { EndOfGameStateHandler } from '../stateHandlers/endOfGame.js'
import { minimumBid } from './economy.js'
import { openShareAuction } from './shareAuctionRules.js'
import { AuctionKind } from './auction.js'
import { homeLinks } from './track.js'

const SOUTH_AFRICA = sarMap(MapId.SouthAfrica)
const engine = new GameEngine(SarRuntime)
const game = SarRuntime.initializer.initializeGame(
    {
        id: 'sar-rules',
        typeId: Definition.info.id,
        ownerId: 'owner',
        config: { map: MapId.SouthAfrica },
        players: ['a', 'b', 'c', 'd'].map((id) => ({
            id,
            name: id,
            isHuman: true,
            status: PlayerStatus.Joined
        }))
    },
    Definition
)

let step = 0
function run(state: SarGameState, action: Record<string, unknown>): SarGameState {
    const [playerId] = state.activePlayerIds
    const full: GameAction = {
        id: `t${step++}`,
        gameId: game.id,
        source: ActionSource.User,
        playerId,
        type: ActionType.PassBid,
        ...action
    }
    return engine.executeCanonicalAction({ game, state, action: full }).updatedState
}

// Every opening share goes unbid to its opener, who builds the first home link listed, unless
// a bid is given for that railroad: then its bidder takes it at $1 and the others pass.
function afterInitialOffering(bids: Partial<Record<RailroadId, string>> = {}): SarGameState {
    let state = engine.startGame(game, {
        masterSeed: '0123456789abcdef0123456789abcdef',
        startingPositions: { playerIds: ['a', 'b', 'c', 'd'] }
    }).initialState
    while (state.machineState !== MachineState.ChoosingAction) {
        if (state.machineState === MachineState.Bidding) {
            const bidder = state.auction ? bids[state.auction.railroadId] : undefined
            const placesBid =
                bidder === state.activePlayerIds[0] && !hydrate(state).bidding().hasBid
            state = run(state, placesBid ? { type: ActionType.PlaceBid, amount: 1 } : {})
        } else {
            const due = state.freeBuild
            assertExists(due, 'Free build due')
            const linkId = homeLinks(hydrate(state), SOUTH_AFRICA.home(due.railroadId))[0]
            state = run(state, {
                type: ActionType.BuildTrack,
                railroadId: due.railroadId,
                linkIds: [linkId]
            })
        }
    }
    return state
}

function hydrate(state: SarGameState): HydratedSarGameState {
    return SarRuntime.hydrator.hydrateState(state)
}

describe('the initial offering', () => {
    it('gives every unbid share to its opener and starts with the CMRC holder', () => {
        const state = hydrate(afterInitialOffering())
        expect(state.railroad(RailroadId.CdFM).owners).toEqual(['a'])
        expect(state.railroad(RailroadId.CMRC).owners).toEqual(['a'])
        expect(state.isOpen(RailroadId.ZASM)).toBe(false)
        expect(state.activePlayerIds).toEqual(['a'])
    })

    it('gives the first turn to the CMRC buyer and keeps them first in the turn order', () => {
        let state = afterInitialOffering({ [RailroadId.CMRC]: 'c' })
        const hydrated = hydrate(state)
        expect(hydrated.railroad(RailroadId.CMRC).owners).toEqual(['c'])
        expect(hydrated.turnManager.turnOrder).toEqual(['c', 'd', 'a', 'b'])
        expect(hydrated.activePlayerIds).toEqual(['c'])
        state = run(state, { type: ActionType.ChooseAction, box: ActionBox.DevelopSettlements })
        state = run(state, { type: ActionType.Develop, settlementId: 'johannesburg' })
        state = run(state, { type: ActionType.Develop, settlementId: 'johannesburg' })
        expect(state.activePlayerIds).toEqual(['d'])
    })

    it('records the starting incomes the rulebook lists', () => {
        const state = hydrate(afterInitialOffering())
        expect(state.income(RailroadId.CdFM)).toBe(4)
        expect(state.income(RailroadId.CSAR)).toBe(4)
        expect(state.income(RailroadId.NRC)).toBe(4)
        expect(state.income(RailroadId.CMRC)).toBe(4)
        expect([4, 6]).toContain(state.income(RailroadId.CTRD))
    })

    it('puts winning bids in the railroad treasury', () => {
        let state = engine.startGame(game, {
            masterSeed: '0123456789abcdef0123456789abcdef',
            startingPositions: { playerIds: ['a', 'b', 'c', 'd'] }
        }).initialState
        state = run(state, { type: ActionType.PlaceBid, amount: 7 })
        for (let pass = 0; pass < 3; pass++) {
            state = run(state, { type: ActionType.PassBid })
        }
        const hydrated = hydrate(state)
        expect(hydrated.railroad(RailroadId.CdFM).treasury).toBe(7)
        expect(hydrated.getPlayerState('a').cash).toBe(63)
    })

    it('lays a lone free first link without asking, so the next offering opens', () => {
        let state = engine.startGame(game, {
            masterSeed: '0123456789abcdef0123456789abcdef',
            startingPositions: { playerIds: ['a', 'b', 'c', 'd'] }
        }).initialState
        state = run(state, { type: ActionType.PlaceBid, amount: 7 })
        for (let pass = 0; pass < 3; pass++) {
            state = run(state, { type: ActionType.PassBid })
        }
        const hydrated = hydrate(state)
        expect(hydrated.track.filter((built) => built.railroadId === RailroadId.CdFM)).toHaveLength(
            1
        )
        expect(hydrated.machineState).toBe(MachineState.Bidding)
        expect(hydrated.auction?.railroadId).toBe(RailroadId.CSAR)
    })

    it('drops a bidder who cannot afford the next bid', () => {
        let state = engine.startGame(game, {
            masterSeed: '0123456789abcdef0123456789abcdef',
            startingPositions: { playerIds: ['a', 'b', 'c', 'd'] }
        }).initialState
        const b = state.players.find((player) => player.playerId === 'b')
        assertExists(b, 'Player b is seated')
        b.cash = 7
        state = run(state, { type: ActionType.PlaceBid, amount: 7 })
        const hydrated = hydrate(state)
        expect(hydrated.bidding().remainingPlayerIds).not.toContain('b')
        expect(hydrated.activePlayerIds).toEqual(['c'])
    })
})

describe('income and value', () => {
    it('matches the rulebook NRC example', () => {
        const state = hydrate(afterInitialOffering())
        state.track = state.track.filter((built) => built.railroadId !== RailroadId.NRC)
        state.track.push(
            { linkId: 'glencoe-junction~ladysmith', railroadId: RailroadId.NRC },
            { linkId: 'glencoe-junction~vryheid', railroadId: RailroadId.NRC },
            { linkId: 'hlobane~vryheid', railroadId: RailroadId.NRC }
        )
        state.developments = { ladysmith: 1, hlobane: 1 }
        expect(state.income(RailroadId.NRC)).toBe(15)
        expect(state.value(RailroadId.NRC)).toBe(15)
        expect(state.minimumBid(RailroadId.NRC)).toBe(3)
        expect(state.dividendPerShare(RailroadId.NRC)).toBe(3)
    })

    it('totals the next dividend over every share a player holds', () => {
        const state = hydrate(afterInitialOffering())
        const [holder] = state.railroad(RailroadId.CdFM).owners
        const expected = state
            .holdings(holder)
            .reduce(
                (sum, holding) => sum + holding.shares * state.dividendPerShare(holding.railroadId),
                0
            )
        expect(expected).toBeGreaterThan(0)
        expect(state.nextDividend(holder)).toBe(expected)
        state.dividendsPaid = 5
        expect(state.nextDividend(holder)).toBe(
            state
                .holdings(holder)
                .reduce(
                    (sum, holding) =>
                        sum + holding.shares * state.finalPayoffPerShare(holding.railroadId),
                    0
                )
        )
    })

    it('rounds the final payoff up over the shares sold', () => {
        const state = hydrate(afterInitialOffering())
        // CdFM: one $5 link worth 4 income, one share sold.
        expect(state.finalPayoffPerShare(RailroadId.CdFM)).toBe(9)
        state.railroad(RailroadId.CdFM).owners.push('b')
        expect(state.finalPayoffPerShare(RailroadId.CdFM)).toBe(5)
    })
})

describe('choosing an action', () => {
    it('forbids repeating the last action except Construct Track', () => {
        const state = hydrate(afterInitialOffering())
        state.getPlayerState('a').locomotive = ActionBox.OfferStock
        expect(state.availableBoxes('a')).not.toContain(ActionBox.OfferStock)
        state.getPlayerState('a').locomotive = ActionBox.ConstructTrack
        expect(state.availableBoxes('a')).toContain(ActionBox.ConstructTrack)
    })

    it('closes a box once its slots are full', () => {
        const state = hydrate(afterInitialOffering())
        state.getPlayerState('b').locomotive = ActionBox.PayDividends
        expect(state.availableBoxes('a')).not.toContain(ActionBox.PayDividends)
        state.getPlayerState('c').locomotive = ActionBox.DevelopSettlements
        expect(state.availableBoxes('a')).toContain(ActionBox.DevelopSettlements)
        state.getPlayerState('d').locomotive = ActionBox.DevelopSettlements
        expect(state.availableBoxes('a')).not.toContain(ActionBox.DevelopSettlements)
    })

    it('ends the turn of an action with nothing to do', () => {
        const state = afterInitialOffering()
        for (const railroad of state.railroads.filter((candidate) => candidate.owners.length > 0)) {
            railroad.owners = ['b', 'b', 'b', 'b', 'b']
        }
        const after = hydrate(
            run(state, { type: ActionType.ChooseAction, box: ActionBox.OfferStock })
        )
        expect(after.getPlayerState('a').locomotive).toBe(ActionBox.OfferStock)
        expect(after.machineState).toBe(MachineState.ChoosingAction)
        expect(after.activePlayerIds).toEqual(['b'])
    })

    it('ends the turn of a Construct Track with no link a funded railroad can build', () => {
        const hydrated = hydrate(afterInitialOffering())
        hydrated.track = SOUTH_AFRICA.links.map((link) => ({
            linkId: link.id,
            railroadId: RailroadId.CdFM
        }))
        for (const railroad of hydrated.railroads) {
            railroad.treasury = railroad.id === RailroadId.CdFM ? 0 : 100
        }
        expect(hydrated.buildableRailroads()).toEqual([])
        expect(HydratedChooseAction.nothingToDo(hydrated, ActionBox.ConstructTrack, 'a')).toBe(true)
        const after = hydrate(
            run(hydrated.dehydrate(), {
                type: ActionType.ChooseAction,
                box: ActionBox.ConstructTrack
            })
        )
        expect(after.machineState).toBe(MachineState.ChoosingAction)
        expect(after.activePlayerIds).toEqual(['b'])
    })

    it('ends the turn of a Develop Settlements with nothing left to develop', () => {
        const hydrated = hydrate(afterInitialOffering())
        hydrated.developments = Object.fromEntries(
            SOUTH_AFRICA.settlements.map((place) => [
                place.id,
                SOUTH_AFRICA.maxDevelopments(place.id)
            ])
        )
        const after = hydrate(
            run(hydrated.dehydrate(), {
                type: ActionType.ChooseAction,
                box: ActionBox.DevelopSettlements
            })
        )
        expect(after.machineState).toBe(MachineState.ChoosingAction)
        expect(after.activePlayerIds).toEqual(['b'])
    })

    it('knows which boxes pay dividends at once when chosen', () => {
        const state = hydrate(afterInitialOffering())
        state.actionTrack = 31
        expect(ACTION_BOXES.filter((box) => state.triggersDividends(box)).toSorted()).toEqual(
            [ActionBox.DevelopSettlements, ActionBox.PayDividends].toSorted()
        )
        state.actionTrack = 33
        expect(state.triggersDividends(ActionBox.ConstructTrack)).toBe(true)
    })

    it('opens the third Offer Stock slot in every game but the three-player one', () => {
        expect(
            [3, 4, 5, 6].map((count) => boxCapacity(ActionBox.OfferStock, count, SOUTH_AFRICA))
        ).toEqual([2, 3, 3, 3])
    })
})

describe('construction', () => {
    it('never passes a double build through Johannesburg', () => {
        const state = hydrate(afterInitialOffering())
        state.railroad(RailroadId.CTRD).treasury = 15
        state.track.push(
            { linkId: 'klerksdorp~potchefstroom', railroadId: RailroadId.CTRD },
            { linkId: 'klerksdorp~vierfontein', railroadId: RailroadId.CTRD },
            { linkId: 'kroonstad~vierfontein', railroadId: RailroadId.CTRD },
            { linkId: 'dover~kroonstad', railroadId: RailroadId.CTRD }
        )
        const middle = ([first, second]: readonly [string, string]) =>
            first.split('~').find((end) => second.split('~').includes(end))
        const doubles = state.doubleBuilds(RailroadId.CTRD)
        expect(doubles).toContainEqual(['dover~vereeniging', 'johannesburg~vereeniging'])
        expect(doubles.every((build) => middle(build) !== 'johannesburg')).toBe(true)
    })

    it('needs track at Mafeking and pays a rounded-down special dividend', () => {
        let state = afterInitialOffering()
        const hydrated = hydrate(state)
        hydrated.railroad(RailroadId.CTRD).treasury = 30
        hydrated.track.push(
            { linkId: 'mafeking~purdimoe', railroadId: RailroadId.CTRD },
            { linkId: 'purdimoe~warrenton', railroadId: RailroadId.CTRD },
            { linkId: 'kimberley~warrenton', railroadId: RailroadId.CTRD }
        )
        expect(hydrated.connectionBuilds(RailroadId.CTRD).map((c) => c.id)).toEqual([
            'bechuanaland'
        ])
        state = hydrated.dehydrate()
        state = run(state, { type: ActionType.ChooseAction, box: ActionBox.ConstructTrack })
        const owner = hydrate(state).controllers(RailroadId.CTRD)[0]
        const income = hydrate(state).income(RailroadId.CTRD)
        if (state.activePlayerIds[0] !== owner) {
            state = run(state, {
                type: ActionType.DelegateBuild,
                railroadId: RailroadId.CTRD,
                builderId: owner
            })
        }
        const cashBefore = hydrate(state).getPlayerState(owner).cash
        state = run(state, {
            type: ActionType.BuildConnection,
            railroadId: RailroadId.CTRD,
            connectionId: 'bechuanaland'
        })
        const after = hydrate(state)
        const links = after.track.filter((t) => t.railroadId === RailroadId.CTRD).length
        expect(after.value(RailroadId.CTRD)).toBe(links * 5 + 40)
        expect(after.getPlayerState(owner).cash - cashBefore).toBe(Math.floor(income / 5))
    })

    it('opens the ZASM for auction when track reaches Johannesburg', () => {
        let state = afterInitialOffering()
        const hydrated = hydrate(state)
        hydrated.railroad(RailroadId.CdFM).treasury = 5
        hydrated.track.push(
            { linkId: 'kaapmuiden~komatipoort', railroadId: RailroadId.CdFM },
            { linkId: 'kaapmuiden~nelspruit', railroadId: RailroadId.CdFM },
            { linkId: 'machadodorp~nelspruit', railroadId: RailroadId.CdFM },
            { linkId: 'belfast~machadodorp', railroadId: RailroadId.CdFM },
            { linkId: 'belfast~witbank', railroadId: RailroadId.CdFM }
        )
        state = hydrated.dehydrate()
        state = run(state, { type: ActionType.ChooseAction, box: ActionBox.ConstructTrack })
        state = run(state, {
            type: ActionType.BuildTrack,
            railroadId: RailroadId.CdFM,
            linkIds: ['johannesburg~witbank']
        })
        const after = hydrate(state)
        expect(after.machineState).toBe(MachineState.Bidding)
        expect(after.auction?.railroadId).toBe(RailroadId.ZASM)
        expect(after.activePlayerIds).toEqual(['a'])
    })
})

describe('income gains shown before choosing', () => {
    it('predicts what a link adds to its railroad income', () => {
        const state = hydrate(afterInitialOffering())
        for (const railroadId of [RailroadId.CSAR, RailroadId.NRC]) {
            const before = state.income(railroadId)
            for (const linkId of state.singleBuilds(railroadId).slice(0, 5)) {
                const built = hydrate(structuredClone(state.dehydrate()))
                built.track.push({ linkId, railroadId })
                expect(built.income(railroadId) - before).toBe(state.buildIncomeGain(linkId))
            }
        }
    })

    it('predicts what a development adds to each railroad serving the settlement', () => {
        const state = hydrate(afterInitialOffering())
        const [settlementId] = state.developableSettlements()
        const gains = state.developmentIncomeGains(settlementId)
        const before = new Map(
            SOUTH_AFRICA.railroads.map((railroad) => [railroad.id, state.income(railroad.id)])
        )
        state.developments[settlementId] = state.developmentLevel(settlementId) + 1
        for (const railroad of SOUTH_AFRICA.railroads) {
            const gain = gains.find((entry) => entry.railroadId === railroad.id)?.gain ?? 0
            expect(state.income(railroad.id) - (before.get(railroad.id) ?? 0)).toBe(gain)
        }
    })
})

describe('developing settlements', () => {
    it('charges $3 for a second development except in Johannesburg', () => {
        let state = afterInitialOffering()
        state = run(state, { type: ActionType.ChooseAction, box: ActionBox.DevelopSettlements })
        state = run(state, { type: ActionType.Develop, settlementId: 'lourenco-marques' })
        const hydrated = hydrate(state)
        expect(hydrated.developmentCost('johannesburg')).toBe(0)
        expect(hydrated.developmentCost('komatipoort')).toBe(3)
        expect(hydrated.automaticDevelopmentTarget()).toBe('johannesburg')
        const cash = hydrated.getPlayerState('a').cash
        state = run(state, { type: ActionType.Develop, settlementId: 'komatipoort' })
        const after = hydrate(state)
        expect(after.getPlayerState('a').cash).toBe(cash - 3)
        expect(after.income(RailroadId.CdFM)).toBe(8)
        expect(after.machineState).toBe(MachineState.ChoosingAction)
    })

    it('develops Johannesburg twice in one action when it is also the first choice', () => {
        let state = afterInitialOffering()
        state = run(state, { type: ActionType.ChooseAction, box: ActionBox.DevelopSettlements })
        state = run(state, { type: ActionType.Develop, settlementId: 'johannesburg' })
        const hydrated = hydrate(state)
        expect(hydrated.developmentCost('johannesburg')).toBe(0)
        expect(hydrated.automaticDevelopmentTarget()).toBe('johannesburg')
        state = run(state, { type: ActionType.Develop, settlementId: 'johannesburg' })
        const after = hydrate(state)
        expect(after.developmentLevel('johannesburg')).toBe(2)
        expect(after.machineState).toBe(MachineState.ChoosingAction)
    })

    it('develops Johannesburg when the player declines the paid second development', () => {
        let state = afterInitialOffering()
        state = run(state, { type: ActionType.ChooseAction, box: ActionBox.DevelopSettlements })
        state = run(state, { type: ActionType.Develop, settlementId: 'lourenco-marques' })
        state = run(state, { type: ActionType.FinishDevelopment })
        const after = hydrate(state)
        expect(after.developmentLevel('johannesburg')).toBe(1)
        expect(after.machineState).toBe(MachineState.ChoosingAction)
    })

    it('lets the player stop after one development once Johannesburg is full', () => {
        const state = hydrate(afterInitialOffering())
        state.developments = { johannesburg: 8 }
        state.developmentsThisTurn = 1
        expect(state.mayFinishDeveloping()).toBe(true)
        expect(
            SarRuntime.stateHandlers[MachineState.DevelopingSettlements].validActionsForPlayer(
                'a',
                new MachineContext({ gameConfig: {}, gameState: state })
            )
        ).toContain(ActionType.FinishDevelopment)
    })
})

describe('auctions', () => {
    it('bids clockwise in seat order from the opener', () => {
        const state = hydrate(afterInitialOffering())
        openShareAuction(state, {
            kind: AuctionKind.OfferStock,
            railroadId: RailroadId.CdFM,
            openerId: 'c'
        })
        expect(state.bidding().remainingPlayerIds).toEqual(['c', 'd', 'a', 'b'])
    })

    it('rounds a fifth of the value up for the minimum bid', () => {
        expect(minimumBid(15)).toBe(3)
        expect(minimumBid(7)).toBe(2)
    })
})

describe('construction control', () => {
    it('makes a controlling player build with their own railroad rather than hand the build over', () => {
        const state = hydrate(afterInitialOffering())
        for (const railroad of state.openRailroads()) {
            railroad.treasury = 5
        }
        state.railroad(RailroadId.NRC).owners = ['b']
        expect(state.controls(RailroadId.NRC, 'a')).toBe(false)
        expect(state.buildableRailroads()).toContain(RailroadId.NRC)
        expect(HydratedDelegateBuild.canDelegate(state, 'a')).toBe(false)
        expect(state.builderRailroads('a')).not.toContain(RailroadId.NRC)
        expect(state.builderRailroads('a').length).toBeGreaterThan(0)
    })
})

describe('the end of the game', () => {
    function finish(cash: Record<string, number>) {
        const state = hydrate(afterInitialOffering())
        for (const player of state.players) {
            player.cash = cash[player.playerId]
        }
        new EndOfGameStateHandler().enter(new MachineContext({ gameConfig: {}, gameState: state }))
        return state
    }

    it('declares the player with the most money the winner', () => {
        const state = finish({ a: 90, b: 120, c: 100, d: 80 })
        expect(state.result).toBe(GameResult.Win)
        expect(state.winningPlayerIds).toEqual(['b'])
    })

    it('shares the win between players tied on money', () => {
        const state = finish({ a: 120, b: 120, c: 100, d: 80 })
        expect(state.result).toBe(GameResult.Draw)
        expect([...state.winningPlayerIds].sort()).toEqual(['a', 'b'])
    })
})

describe('the map', () => {
    it.each(Object.values(MapId))('%s refers only to places it defines', (mapId) => {
        const map = sarMap(mapId)
        const ids = new Set(map.settlements.map((place) => place.id))
        for (const trackLink of map.links) {
            expect(trackLink.ends.every((end) => ids.has(end))).toBe(true)
        }
        for (const connection of map.externalConnections) {
            expect(ids.has(connection.settlementId)).toBe(true)
        }
        for (const railroad of map.railroads) {
            expect(ids.has(railroad.homeId)).toBe(true)
        }
        for (const metroId of map.definition.automaticDevelopment) {
            expect(map.settlement(metroId).kind).toBe(SettlementKind.MetroArea)
        }
        expect(ids.has(map.definition.doubleBuildBarrierId)).toBe(true)
        for (const place of map.settlements) {
            expect(map.incomeLevels(place.id).length).toBeGreaterThan(1)
        }
        const railroadIds = map.railroads.map((railroad) => railroad.id)
        expect(map.initialOffering.every((id) => railroadIds.includes(id))).toBe(true)
        expect(map.initialOffering).toContain(map.definition.startPlayerRailroad)
    })

    it('opens a railroad outside the initial offering only when track first reaches its home', () => {
        const state = hydrate(afterInitialOffering())
        expect(state.railroadOpenedBy(['johannesburg~witbank'])).toBe(RailroadId.ZASM)
        expect(state.railroadOpenedBy(['belfast~witbank'])).toBeUndefined()
        state.railroad(RailroadId.ZASM).owners = ['a']
        expect(state.railroadOpenedBy(['johannesburg~witbank'])).toBeUndefined()
    })
})
