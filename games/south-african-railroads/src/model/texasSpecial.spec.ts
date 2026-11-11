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

const TEXAS = sarMap(MapId.TexasSpecial)
const engine = new GameEngine(SarRuntime)
const game = SarRuntime.initializer.initializeGame(
    {
        id: 'texas-rules',
        typeId: Definition.info.id,
        ownerId: 'owner',
        config: { map: MapId.TexasSpecial },
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
            const linkId = homeLinks(hydrate(state), TEXAS.home(due.railroadId))[0]
            state = run(state, {
                type: ActionType.BuildTrack,
                railroadId: due.railroadId,
                linkIds: [linkId]
            })
        }
    }
    return state
}

function withTrack(
    state: SarGameState,
    railroadId: RailroadId,
    linkIds: string[],
    treasury: number
): SarGameState {
    const hydrated = hydrate(state)
    hydrated.track.push(...linkIds.map((linkId) => ({ linkId, railroadId })))
    hydrated.railroad(railroadId).treasury = treasury
    return hydrated.dehydrate()
}

describe('the Texas Special opening', () => {
    it('offers the five railroads in the order the map lists, the T&P closed', () => {
        const state = hydrate(afterInitialOffering())
        expect(TEXAS.initialOffering).toEqual([
            RailroadId.MKT,
            RailroadId.MP,
            RailroadId.SP,
            RailroadId.GHH,
            RailroadId.SLSF
        ])
        for (const railroadId of TEXAS.initialOffering) {
            expect(state.railroad(railroadId).open).toBe(true)
            expect(state.track.some((built) => built.railroadId === railroadId)).toBe(true)
        }
        expect(state.railroad(RailroadId.TP).open).toBe(false)
    })

    it('gives the first turn to the Frisco buyer', () => {
        const state = hydrate(afterInitialOffering({ [RailroadId.SLSF]: 'c' }))
        expect(state.railroad(RailroadId.SLSF).owners).toEqual(['c'])
        expect(state.turnManager.turnOrder[0]).toBe('c')
        expect(state.activePlayerIds).toEqual(['c'])
    })
})

describe('Texas Special construction', () => {
    it('opens the T&P when track first reaches Dallas, the connecting player bidding first', () => {
        let state = withTrack(afterInitialOffering(), RailroadId.MKT, ['bishop~denton'], 5)
        state = run(state, { type: ActionType.ChooseAction, box: ActionBox.ConstructTrack })
        state = run(state, {
            type: ActionType.BuildTrack,
            railroadId: RailroadId.MKT,
            linkIds: ['dallas~denton']
        })
        const after = hydrate(state)
        expect(after.machineState).toBe(MachineState.Bidding)
        expect(after.auction?.railroadId).toBe(RailroadId.TP)
        expect(after.activePlayerIds).toEqual(['a'])
    })

    it('never passes a double build through Dallas', () => {
        const state = hydrate(
            withTrack(afterInitialOffering(), RailroadId.MKT, ['bishop~denton'], 15)
        )
        const middle = ([first, second]: readonly [string, string]) =>
            first.split('~').find((end) => second.split('~').includes(end))
        const doubles = state.doubleBuilds(RailroadId.MKT)
        expect(doubles).toContainEqual(['denton~greenville', 'greenville~mineola'])
        expect(state.singleBuilds(RailroadId.MKT)).toContain('dallas~denton')
        expect(doubles.every((build) => middle(build) !== 'dallas')).toBe(true)
    })
})

describe('Texas Special development', () => {
    it('pays a natural resource $1, or $5 once developed', () => {
        expect(TEXAS.incomeLevels('chanute-resource')).toEqual([1, 5])
    })

    it('charges $3 for a second development, Dallas included', () => {
        let state = withTrack(
            afterInitialOffering(),
            RailroadId.MKT,
            ['bishop~denton', 'dallas~denton'],
            0
        )
        state = run(state, { type: ActionType.ChooseAction, box: ActionBox.DevelopSettlements })
        state = run(state, { type: ActionType.Develop, settlementId: 'denton' })
        const hydrated = hydrate(state)
        expect(hydrated.developmentCost('dallas')).toBe(3)
        expect(hydrated.developableSettlements()).toContain('dallas')
    })

    it('develops Dallas, then Kansas City, when the second development is declined', () => {
        let state = afterInitialOffering()
        state = run(state, { type: ActionType.ChooseAction, box: ActionBox.DevelopSettlements })
        const [first] = hydrate(state).affordableDevelopments('a')
        state = run(state, { type: ActionType.Develop, settlementId: first })
        state = run(state, { type: ActionType.FinishDevelopment })
        expect(hydrate(state).developmentLevel('dallas')).toBe(1)

        const full = hydrate(state)
        full.developments.dallas = 3
        expect(full.automaticDevelopmentTarget()).toBe('kansas-city')
        full.developments['kansas-city'] = 3
        full.developments.memphis = 3
        expect(full.automaticDevelopmentTarget()).toBeUndefined()
    })
})

describe('Leave Town', () => {
    function townState(): SarGameState {
        const state = hydrate(
            withTrack(
                afterInitialOffering(),
                RailroadId.MKT,
                ['junction-city~topeka', 'emporia~emporia-resource', 'emporia~junction-city'],
                0
            )
        )
        state.developments = { topeka: 1, 'emporia-resource': 1, wichita: 1 }
        return state.dehydrate()
    }

    it('takes a cube only from a developed settlement a controlled railroad serves, never a natural resource', () => {
        const state = hydrate(townState())
        expect(state.leaveTownOptions('a')).toEqual(['topeka'])
        expect(state.leaveTownOptions('b')).toEqual([])
    })

    it('moves the cube to the player, then develops the next metro area, and ends the turn', () => {
        let state = townState()
        state = run(state, { type: ActionType.ChooseAction, box: ActionBox.DevelopSettlements })
        state = run(state, { type: ActionType.LeaveTown, settlementId: 'topeka' })
        const after = hydrate(state)
        expect(after.developmentLevel('topeka')).toBe(0)
        expect(after.getPlayerState('a').leaveTownCubes).toBe(1)
        expect(after.developmentLevel('dallas')).toBe(1)
        expect(after.machineState).toBe(MachineState.ChoosingAction)
        expect(after.activePlayerIds).toEqual(['b'])
    })

    it('pays $3 a cube at every dividend, the final one included', () => {
        let state = hydrate(afterInitialOffering())
        state.getPlayerState('b').leaveTownCubes = 2
        expect(state.nextDividend('b')).toBe(6)
        expect(state.projectedFinalCash('b')).toBe(state.getPlayerState('b').cash + 6)
        const cash = state.getPlayerState('b').cash
        let next = run(state.dehydrate(), {
            type: ActionType.ChooseAction,
            box: ActionBox.PayDividends
        })
        expect(hydrate(next).getPlayerState('b').cash).toBe(cash + 6)

        state = hydrate(next)
        state.dividendsPaid = 5
        state.getPlayerState('a').locomotive = ActionBox.ConstructTrack
        const before = state.getPlayerState('b').cash
        next = state.dehydrate()
        next = run(next, { type: ActionType.ChooseAction, box: ActionBox.PayDividends })
        const finished = hydrate(next)
        expect(finished.result).toBeDefined()
        expect(finished.getPlayerState('b').cash).toBe(before + 6)
    })
})

describe('the Texas Special', () => {
    function meetingState(): SarGameState {
        const state = withTrack(afterInitialOffering(), RailroadId.MKT, ['fort-worth~stamford'], 30)
        return withTrack(state, RailroadId.SP, ['austin~stamford'], 0)
    }

    it('joins a northern and a southern railroad whose track meets', () => {
        const state = hydrate(meetingState())
        expect(state.specialConnectionPartners(RailroadId.MKT)).toEqual([RailroadId.SP])
        expect(state.specialConnectionPartners(RailroadId.SLSF)).toEqual([])
        state.railroad(RailroadId.MKT).treasury = 29
        expect(state.specialConnectionPartners(RailroadId.MKT)).toEqual([])
    })

    it('costs $30, pays both a special dividend, happens once and adds $20 to their final value', () => {
        let state = meetingState()
        const before = hydrate(state)
        const katyPayoff = before.finalPayoffPerShare(RailroadId.MKT)
        const cash = before.getPlayerState('a').cash
        const special =
            before.specialDividendPerShare(RailroadId.MKT) *
                before.sharesHeld(RailroadId.MKT, 'a') +
            before.specialDividendPerShare(RailroadId.SP) * before.sharesHeld(RailroadId.SP, 'a')
        state = run(state, { type: ActionType.ChooseAction, box: ActionBox.ConstructTrack })
        state = run(state, {
            type: ActionType.FoundSpecialConnection,
            railroadId: RailroadId.MKT,
            partnerId: RailroadId.SP
        })
        const after = hydrate(state)
        expect(after.specialConnection).toEqual([RailroadId.MKT, RailroadId.SP])
        expect(after.railroad(RailroadId.MKT).treasury).toBe(0)
        expect(after.getPlayerState('a').cash).toBe(cash + special)
        expect(after.finalPayoffPerShare(RailroadId.MKT)).toBe(katyPayoff + 20)
        expect(after.machineState).toBe(MachineState.ChoosingAction)
        after.railroad(RailroadId.MP).treasury = 30
        expect(after.specialConnectionPartners(RailroadId.MP)).toEqual([])
    })
})
