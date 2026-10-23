import { describe, expect, it } from 'vitest'
import { ActionSource, assertExists } from '@tabletop/common'
import { HydratedResolveAnomaly } from '../actions/resolveAnomaly.js'
import { Faction } from '../components/factions.js'
import { ScenarioId } from '../components/scenarios.js'
import { SOL_SYSTEM_ID } from '../components/systems.js'
import { TradeGood } from '../components/tradeGoods.js'
import { WorldSide } from '../components/worlds.js'
import { ActionType } from '../definition/actions.js'
import { CargoPartnerKind } from './cargoTransfer.js'
import { demandedGoods, keepDemand } from './demand.js'
import { produceAtBases } from './economy.js'
import { grantPactShares } from './pactResolution.js'
import { removeShip } from './fleet.js'
import type { HydratedStellarHorizonsGameState } from './gameState.js'
import { AnomalyChallenge } from '../components/anomalies.js'
import { CASH_PRODUCTION, PactTargetKind } from './pieces.js'
import { addSettlements, removeBaseSettlement } from './settling.js'
import { resolveNextSurvey } from './surveys.js'
import {
    GoodsHolderKind,
    type GoodsStore,
    assignGoods,
    assignmentProblem,
    destroyUnplaceableRewardGoods,
    drawTradeGoods,
    goodsRewardProblem,
    goodsTransferLimits,
    placeRewardGoods,
    saleOptions,
    saleProblem,
    storeRooms,
    salePrice,
    sellGoods
} from './trade.js'
import { hydrate, placeBase, placeShip, startedGame } from '../testing/fixtures.js'

const SYSTEM = 'alpha-centauri'
const AT_BASE: GoodsStore = { kind: GoodsHolderKind.Base, systemId: SYSTEM }
const AT_EARTH: GoodsStore = { kind: GoodsHolderKind.Earth }

// The game starts inside the first Player's exploration Branch; these rules are played on the
// Main Line.
function campaign(playerCount = 3): HydratedStellarHorizonsGameState {
    const state = hydrate(startedGame(playerCount, { scenario: ScenarioId.Campaign }).state)
    state.parallelSpan = undefined
    return state
}

function consortium(state: HydratedStellarHorizonsGameState): string {
    const [playerId] = state.initiativeOrder()
    state.getPlayerState(playerId).faction = Faction.Consortium
    return playerId
}

function setWorlds(state: HydratedStellarHorizonsGameState, systemId: string, tileIds: string[]) {
    for (const tileId of tileIds) {
        for (const pool of [state.worldPool, state.setAsideWorlds]) {
            if (pool.includes(tileId)) pool.splice(pool.indexOf(tileId), 1)
        }
    }
    state.systemState(systemId).worlds = tileIds.map((tileId) => ({ tileId, side: WorldSide.I }))
}

function playerOf(state: HydratedStellarHorizonsGameState, faction: Faction): string {
    const player = state.players.find((candidate) => candidate.faction === faction)
    assertExists(player, `Nobody plays the ${faction}`)
    return player.playerId
}

function others(state: HydratedStellarHorizonsGameState, faction: Faction): string[] {
    return state.players
        .filter((candidate) => candidate.faction !== faction)
        .map((candidate) => candidate.playerId)
}

describe('Drawing and assigning trade goods', () => {
    it('draws the century’s goods for each Player from the one pool', () => {
        const state = campaign()
        const before = state.goodsPool.length
        const draws = drawTradeGoods(state)
        expect(draws.map((draw) => draw.playerId)).toEqual(state.initiativeOrder())
        const drawn = draws.reduce((total, draw) => total + draw.goods.length, 0)
        expect(drawn).toBeGreaterThan(0)
        expect(state.goodsPool).toHaveLength(before - drawn)
    })

    it('goes to a base with one of the good’s world types, or to Earth if it lists M', () => {
        const state = campaign()
        const [playerId] = state.initiativeOrder()
        setWorlds(state, SYSTEM, ['l-1'])
        placeBase(state, playerId, SYSTEM, 5)
        state.getPlayerState(playerId).drawnGoods = [
            TradeGood.Food,
            TradeGood.Ore,
            TradeGood.FineArt
        ]
        const food = { good: TradeGood.Food, store: AT_BASE }
        expect(assignmentProblem(state, playerId, [food])).toBeUndefined()
        expect(
            assignmentProblem(state, playerId, [{ good: TradeGood.Ore, store: AT_BASE }])
        ).toBeDefined()
        expect(
            assignmentProblem(state, playerId, [{ good: TradeGood.Food, store: AT_EARTH }])
        ).toBeUndefined()
        expect(
            assignmentProblem(state, playerId, [{ good: TradeGood.FineArt, store: AT_EARTH }])
        ).toBeDefined()

        const cash = state.getPlayerState(playerId).cash
        const result = assignGoods(state, playerId, [food])
        expect(state.base(playerId, SYSTEM)?.goods).toEqual([TradeGood.Food])
        expect(result.discarded).toEqual([TradeGood.Ore, TradeGood.FineArt])
        expect(state.getPlayerState(playerId).cash).toBe(cash + 2)
    })

    it('keeps within the base’s limit for the turn, its storage and 12 goods in all', () => {
        const state = campaign()
        const [playerId] = state.initiativeOrder()
        setWorlds(state, SYSTEM, ['m-1'])
        const base = placeBase(state, playerId, SYSTEM, 4)
        const two = [
            { good: TradeGood.Food, store: AT_BASE },
            { good: TradeGood.Fauna, store: AT_BASE }
        ]
        state.getPlayerState(playerId).drawnGoods = [TradeGood.Food, TradeGood.Fauna]
        // Under 5 settlements a base takes 1 good a turn and stores 2.
        expect(assignmentProblem(state, playerId, two)).toMatch(/no more goods this turn/)
        base.settlements = 10
        expect(assignmentProblem(state, playerId, two)).toBeUndefined()
        expect(storeRooms(state, playerId, two).at(-1)).toMatchObject({
            stored: 2,
            storage: 4,
            intake: 0
        })
        base.goods = [TradeGood.Ore, TradeGood.Ore, TradeGood.Ore]
        expect(assignmentProblem(state, playerId, two)).toMatch(/stores 4/)
        base.goods = []
        placeShip(state, playerId, 'starfarers-kepler', SYSTEM, {
            goods: Array(11).fill(TradeGood.Food)
        })
        expect(assignmentProblem(state, playerId, two)).toMatch(/12 goods/)
    })

    it('never goes to a base where Smugglers are at large', () => {
        const state = campaign()
        const [playerId] = state.initiativeOrder()
        setWorlds(state, SYSTEM, ['m-1'])
        placeBase(state, playerId, SYSTEM, 5)
        state.events = [{ eventId: 'smugglers', systemId: SYSTEM }]
        state.getPlayerState(playerId).drawnGoods = [TradeGood.Food]
        expect(
            assignmentProblem(state, playerId, [{ good: TradeGood.Food, store: AT_BASE }])
        ).toBeDefined()
    })
})

describe('Goods from anomalies', () => {
    it('are made at each producing base by an anomaly back, or paid as $1B', () => {
        const state = campaign()
        const [first, second] = state.initiativeOrder()
        setWorlds(state, SYSTEM, ['m-1'])
        state.anomalyPool.splice(state.anomalyPool.indexOf('megafauna'), 1)
        state.systemState(SYSTEM).anomaly = 'megafauna'
        state.systemState(SYSTEM).anomalyResolved = true
        const producing = placeBase(state, first, SYSTEM, 5)
        producing.production = CASH_PRODUCTION
        const full = placeBase(state, second, SYSTEM, 1)
        full.production = CASH_PRODUCTION
        full.goods = [TradeGood.Food, TradeGood.Food]
        const results = produceAtBases(state)
        expect(results.map((result) => result.goods)).toEqual([
            { goods: [TradeGood.Fauna], cash: 0 },
            { goods: [], cash: 1 }
        ])
        expect(state.base(first, SYSTEM)?.goods).toEqual([TradeGood.Fauna])

        // While Smugglers are at large the system makes no goods at all.
        state.events = [{ eventId: 'smugglers', systemId: SYSTEM }]
        producing.production = CASH_PRODUCTION
        expect(produceAtBases(state)[0].goods).toEqual({ goods: [], cash: 0 })
    })

    it('from a front go into cargo or onto the base there; the rest earn $1B', () => {
        const state = campaign()
        const [playerId] = state.initiativeOrder()
        setWorlds(state, SYSTEM, ['m-1'])
        state.anomalyPool.splice(state.anomalyPool.indexOf('megafauna'), 1)
        state.systemState(SYSTEM).anomaly = 'megafauna'
        placeShip(state, playerId, 'consortium-guildmaster', SYSTEM)
        placeBase(state, playerId, SYSTEM, 5)
        state.getPlayerState(playerId).anomalyAttempts.push({
            systemId: SYSTEM,
            anomalyId: 'megafauna',
            shipIds: []
        })
        const action = new HydratedResolveAnomaly({
            id: 'resolve',
            gameId: state.gameId,
            source: ActionSource.System,
            type: ActionType.ResolveAnomaly
        })
        action.apply(state)
        expect(state.goodsRewards).toEqual([
            {
                playerId,
                anomalyId: 'megafauna',
                systemId: SYSTEM,
                good: TradeGood.Fauna,
                count: 2
            }
        ])
        const ship = { kind: GoodsHolderKind.Ship, shipId: 'consortium-guildmaster' } as const
        const base = { kind: GoodsHolderKind.Base, systemId: SYSTEM } as const
        // A base of 5 takes 1 good a turn, Fauna or not.
        expect(goodsRewardProblem(state, [{ holder: base, count: 2 }])).toBeDefined()
        const cash = state.getPlayerState(playerId).cash
        placeRewardGoods(state, [{ holder: ship, count: 1 }])
        expect(state.ship('consortium-guildmaster').goods).toEqual([TradeGood.Fauna])
        expect(state.getPlayerState(playerId).cash).toBe(cash + 1)
    })

    it('are split item by item in a pact, each partner placing their own', () => {
        const state = campaign()
        const [first, second] = state.initiativeOrder()
        const share = { influence: 1, cash: 0, markers: 0, settlements: 0, goods: 1 }
        grantPactShares(state, {
            id: 'pact',
            systemId: SYSTEM,
            proposerId: first,
            revision: 0,
            acceptedIds: [first, second],
            agreed: true,
            terms: {
                targetKind: PactTargetKind.Anomaly,
                targetId: 'megafauna',
                challenge: AnomalyChallenge.Combat,
                partnerIds: [first, second],
                pledges: {},
                shares: { [first]: share, [second]: share }
            }
        })
        expect(state.goodsRewards.map((reward) => [reward.playerId, reward.count])).toEqual([
            [first, 1],
            [second, 1]
        ])
    })

    it('with nowhere to go are destroyed for $1B without asking', () => {
        const state = campaign()
        const [playerId] = state.initiativeOrder()
        state.goodsRewards = [
            { playerId, anomalyId: 'megafauna', systemId: SYSTEM, good: TradeGood.Fauna, count: 2 }
        ]
        const cash = state.getPlayerState(playerId).cash
        destroyUnplaceableRewardGoods(state)
        expect(state.goodsRewards).toEqual([])
        expect(state.getPlayerState(playerId).cash).toBe(cash + 2)
    })
})

describe('Selling', () => {
    it('prices a good by its worlds and the distance from Sol', () => {
        const state = campaign()
        // Medicine: $4B, +1 for each P, A or K world, -1 for each M or L world.
        setWorlds(state, SYSTEM, ['m-1', 'k-1'])
        expect(salePrice(state, SYSTEM, TradeGood.Medicine)).toBe(4 + 1 - 1 + 1)
        // Earth counts as M-class: Fine Art gains $1B and no distance.
        expect(salePrice(state, SOL_SYSTEM_ID, TradeGood.FineArt)).toBe(6)
    })

    it('sells where the demand matches, earns 1 IP a good off Earth and replaces the marker', () => {
        const state = campaign()
        const playerId = playerOf(state, Faction.Starfarers)
        setWorlds(state, SYSTEM, ['m-1'])
        placeBase(state, playerId, SYSTEM, 5).goods = [TradeGood.Food]
        placeShip(state, playerId, 'starfarers-kepler', SYSTEM, { goods: [TradeGood.Food] })
        state.systemState(SYSTEM).demand = TradeGood.Food
        state.demandPool.splice(state.demandPool.indexOf(TradeGood.Food), 1)
        const [option] = saleOptions(state, playerId)
        expect(option).toMatchObject({ systemId: SYSTEM, good: TradeGood.Food, payeeIds: [] })
        const player = state.getPlayerState(playerId)
        const { cash, influence } = player
        const result = sellGoods(state, playerId, {
            systemId: SYSTEM,
            good: TradeGood.Food,
            sources: option.sources
        })
        expect(result).toMatchObject({ count: 2, price: 2, cash: 4, influence: 2 })
        expect(player.cash).toBe(cash + 4)
        expect(player.influence).toBe(influence + 2)
        expect(state.systemState(SYSTEM).demand).toBeUndefined()
        expect(state.demandDraws).toEqual([
            { playerId, systemId: SYSTEM, drawn: expect.any(Array) }
        ])
        expect(state.demandDraws[0].drawn).toHaveLength(2)
    })

    it('pays $1B a good to a Player with a base there, unless the seller has one there', () => {
        const state = campaign()
        const seller = playerOf(state, Faction.Starfarers)
        const [host] = others(state, Faction.Starfarers)
        setWorlds(state, SYSTEM, ['m-1'])
        placeBase(state, host, SYSTEM, 5)
        placeShip(state, seller, 'starfarers-kepler', SYSTEM, { goods: [TradeGood.Food] })
        state.systemState(SYSTEM).demand = TradeGood.Food
        const sources = [
            { holder: { kind: GoodsHolderKind.Ship, shipId: 'starfarers-kepler' }, count: 1 }
        ] as const
        const sale = { systemId: SYSTEM, good: TradeGood.Food, sources: [...sources] }
        expect(saleProblem(state, seller, sale)).toBe('Choose whom to pay')
        const hostCash = state.getPlayerState(host).cash
        const result = sellGoods(state, seller, { ...sale, payeeId: host })
        expect(result.payment).toBe(1)
        expect(state.getPlayerState(host).cash).toBe(hostCash + 1)
    })

    it('lets the Consortium sell beside other bases for free and draw 3 markers', () => {
        const state = campaign()
        const seller = consortium(state)
        const [host] = others(state, Faction.Consortium)
        setWorlds(state, SYSTEM, ['m-1'])
        placeBase(state, host, SYSTEM, 5)
        placeShip(state, seller, 'consortium-guildmaster', SYSTEM, {
            goods: [TradeGood.Food]
        })
        state.systemState(SYSTEM).demand = TradeGood.Food
        expect(saleOptions(state, seller)[0].payeeIds).toEqual([])
        sellGoods(state, seller, {
            systemId: SYSTEM,
            good: TradeGood.Food,
            sources: [
                {
                    holder: { kind: GoodsHolderKind.Ship, shipId: 'consortium-guildmaster' },
                    count: 1
                }
            ]
        })
        expect(state.demandDraws[0].drawn).toHaveLength(3)
    })

    it('sells from Earth at Sol, where the marker stays, and never under a "no bases" anomaly', () => {
        const state = campaign()
        const [playerId] = state.initiativeOrder()
        state.getPlayerState(playerId).earthGoods = [TradeGood.Ore]
        const [option] = saleOptions(state, playerId)
        sellGoods(state, playerId, {
            systemId: SOL_SYSTEM_ID,
            good: TradeGood.Ore,
            sources: option.sources
        })
        expect(demandedGoods(state, SOL_SYSTEM_ID)).toContain(TradeGood.Ore)
        expect(state.demandDraws).toEqual([])

        setWorlds(state, SYSTEM, ['m-1'])
        placeShip(state, playerId, 'starfarers-kepler', SYSTEM, { goods: [TradeGood.Food] })
        state.systemState(SYSTEM).demand = TradeGood.Food
        state.anomalyPool.splice(state.anomalyPool.indexOf('hostile-xenomorphs'), 1)
        state.systemState(SYSTEM).anomaly = 'hostile-xenomorphs'
        expect(saleOptions(state, playerId)).toEqual([])
    })
})

describe('Demand markers', () => {
    it('are drawn for a system’s first base and kept one of two', () => {
        const state = campaign()
        const playerId = playerOf(state, Faction.Starfarers)
        setWorlds(state, SYSTEM, ['m-1'])
        addSettlements(state, playerId, SYSTEM, 2)
        const [draw] = state.demandDraws
        expect(draw).toMatchObject({ playerId, systemId: SYSTEM })
        const pool = state.demandPool.length
        keepDemand(state, draw.drawn[1])
        expect(state.systemState(SYSTEM).demand).toBe(draw.drawn[1])
        expect(state.demandPool).toHaveLength(pool + 1)
    })

    it('are drawn by whoever completes the last survey', () => {
        const state = campaign()
        const [playerId] = state.initiativeOrder()
        state.systemState(SYSTEM).explorationMarker = 1
        state.getPlayerState(playerId).pendingSurveys = [{ shipId: 'any', systemId: SYSTEM }]
        resolveNextSurvey(state)
        expect(state.demandDraws.map((draw) => draw.systemId)).toEqual([SYSTEM])
    })

    it('go back when the last base is lost, unless the system is fully surveyed', () => {
        const state = campaign()
        const [playerId] = state.initiativeOrder()
        setWorlds(state, SYSTEM, ['m-1'])
        placeBase(state, playerId, SYSTEM, 1).goods = [TradeGood.Food]
        state.systemState(SYSTEM).demand = TradeGood.Food
        const goods = state.goodsPool.length
        removeBaseSettlement(state, playerId, SYSTEM)
        expect(state.systemState(SYSTEM).demand).toBeUndefined()
        expect(state.goodsPool).toHaveLength(goods + 1)

        placeBase(state, playerId, SYSTEM, 1)
        state.systemState(SYSTEM).demand = TradeGood.Food
        state.systemState(SYSTEM).explorationMarker = 0
        removeBaseSettlement(state, playerId, SYSTEM)
        expect(state.systemState(SYSTEM).demand).toBe(TradeGood.Food)
    })
})

describe('Goods in cargo', () => {
    it('take cargo space beside settlements and go back to the pool with a lost ship', () => {
        const state = campaign()
        const playerId = consortium(state)
        // Guildmaster carries 2.
        const ship = placeShip(state, playerId, 'consortium-guildmaster', SOL_SYSTEM_ID, {
            settlements: 1
        })
        state.getPlayerState(playerId).earthGoods = [TradeGood.Ore, TradeGood.Ore]
        const earth = { kind: CargoPartnerKind.Earth } as const
        expect(goodsTransferLimits(state, ship, earth, TradeGood.Ore).load).toBe(1)
        ship.goods = [TradeGood.Ore]
        const pool = state.goodsPool.length
        removeShip(state, ship.shipId)
        expect(state.goodsPool).toHaveLength(pool + 1)
    })
})
