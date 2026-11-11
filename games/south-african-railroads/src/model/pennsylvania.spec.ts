import { describe, expect, it } from 'vitest'
import {
    ActionSource,
    GameEngine,
    PlayerStatus,
    assertExists,
    type GameAction
} from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { Definition } from '../definition/definition.js'
import { SarRuntime } from '../definition/runtime.js'
import { MachineState } from '../definition/states.js'
import { sarMap } from '../maps/maps.js'
import { MapId, RailroadId } from '../maps/types.js'
import { ActionBox } from './actionBoxes.js'
import type { HydratedSarGameState, SarGameState } from './gameState.js'
import { homeLinks } from './track.js'

const PENNSYLVANIA = sarMap(MapId.Pennsylvania)
const engine = new GameEngine(SarRuntime)
const game = SarRuntime.initializer.initializeGame(
    {
        id: 'pennsylvania-rules',
        typeId: Definition.info.id,
        ownerId: 'owner',
        config: { map: MapId.Pennsylvania },
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
        id: `k${step++}`,
        gameId: game.id,
        source: ActionSource.User,
        playerId,
        type: ActionType.PassBid,
        ...action
    }
    return engine.executeCanonicalAction({ game, state, action: full }).updatedState
}

function hydrate(state: SarGameState): HydratedSarGameState {
    return SarRuntime.hydrator.hydrateState(state)
}

// Every opening share goes unbid to its opener, who builds the first home link listed, unless a
// bidder is named for that railroad: then they take it at $1.
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
            const linkId = homeLinks(hydrate(state), PENNSYLVANIA.home(due.railroadId))[0]
            state = run(state, {
                type: ActionType.BuildTrack,
                railroadId: due.railroadId,
                linkIds: [linkId]
            })
        }
    }
    return state
}

describe('the Pennsylvania Railroad opening', () => {
    it('offers the five numbered railroads in order, the P&LE closed', () => {
        const state = hydrate(afterInitialOffering())
        expect(PENNSYLVANIA.initialOffering).toEqual([
            RailroadId.CO,
            RailroadId.BO,
            RailroadId.NYC,
            RailroadId.BM,
            RailroadId.PRR
        ])
        expect(state.railroad(RailroadId.PLE).open).toBe(false)
    })

    it('gives the first turn to the PRR buyer', () => {
        const state = hydrate(afterInitialOffering({ [RailroadId.PRR]: 'c' }))
        expect(state.turnManager.turnOrder[0]).toBe('c')
    })
})

describe('Pennsylvania Railroad Canadian connections', () => {
    it('add nothing to a railroad value or its final payoff', () => {
        const state = hydrate(afterInitialOffering())
        const value = state.value(RailroadId.NYC)
        const payoff = state.finalPayoffPerShare(RailroadId.NYC)
        state.connections.push({ connectionId: 'niagara', railroadId: RailroadId.NYC })
        expect(PENNSYLVANIA.externalConnection('niagara')).toMatchObject({
            price: 30,
            value: 0
        })
        expect(state.value(RailroadId.NYC)).toBe(value)
        expect(state.finalPayoffPerShare(RailroadId.NYC)).toBe(payoff)
    })
})

describe('Pennsylvania Railroad development', () => {
    it('makes the first development free, the second $3, and the free metro area always free', () => {
        let state = afterInitialOffering()
        state = run(state, { type: ActionType.ChooseAction, box: ActionBox.DevelopSettlements })
        const [first] = hydrate(state)
            .affordableDevelopments('a')
            .filter((id) => id !== 'pittsburgh')
        state = run(state, { type: ActionType.Develop, settlementId: first })
        const second = hydrate(state)
        expect(second.developmentCost(first)).toBe(3)
        expect(second.freeDevelopmentTarget()).toBe('pittsburgh')
        expect(second.developmentCost('pittsburgh')).toBe(0)
        expect(second.developableSettlements()).toContain('pittsburgh')
    })

    it('moves the free metro area along the printed order as each fills, unserved or not', () => {
        const state = hydrate(afterInitialOffering())
        state.developments.pittsburgh = 3
        expect(state.freeDevelopmentTarget()).toBe('cincinnati')
        expect(state.developableSettlements()).toContain('cincinnati')
        expect(state.developableSettlements()).not.toContain('pittsburgh')
        state.developmentsThisTurn = 1
        expect(state.developmentCost('cincinnati')).toBe(0)
        expect(state.developmentCost('st-louis')).toBe(3)
    })

    it('develops the metro areas in the printed order when a second development is declined', () => {
        let state = afterInitialOffering()
        state = run(state, { type: ActionType.ChooseAction, box: ActionBox.DevelopSettlements })
        const [first] = hydrate(state).affordableDevelopments('a')
        state = run(state, { type: ActionType.Develop, settlementId: first })
        state = run(state, { type: ActionType.FinishDevelopment })
        const full = hydrate(state)
        expect(full.developmentLevel('pittsburgh')).toBe(1)
        const order: (string | undefined)[] = []
        for (const id of ['pittsburgh', 'cincinnati', 'st-louis', 'detroit', 'chicago']) {
            full.developments[id] = 3
            order.push(full.automaticDevelopmentTarget())
        }
        expect(order).toEqual(['cincinnati', 'st-louis', 'detroit', 'chicago', undefined])
    })

    it('never passes a double build through Pittsburgh', () => {
        const state = hydrate(afterInitialOffering())
        for (const railroad of PENNSYLVANIA.railroads) {
            state.railroad(railroad.id).treasury = 50
            for (const [first, second] of state.doubleBuilds(railroad.id)) {
                const [a, b] = [first.split('~'), second.split('~')]
                expect(a.filter((end) => b.includes(end))).not.toContain('pittsburgh')
            }
        }
    })
})
