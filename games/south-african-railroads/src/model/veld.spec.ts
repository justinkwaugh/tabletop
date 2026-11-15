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

const VELD = sarMap(MapId.Veld)
const engine = new GameEngine(SarRuntime)
const game = SarRuntime.initializer.initializeGame(
    {
        id: 'veld-rules',
        typeId: Definition.info.id,
        ownerId: 'owner',
        config: { map: MapId.Veld },
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
        id: `o${step++}`,
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

function started(): SarGameState {
    return engine.startGame(game, {
        masterSeed: '0123456789abcdef0123456789abcdef',
        startingPositions: { playerIds: ['a', 'b', 'c', 'd'] }
    }).initialState
}

// Every opening share goes unbid to its opener, a, who builds the first two-way home link listed.
function afterInitialOffering(): SarGameState {
    let state = started()
    while (state.machineState !== MachineState.ChoosingAction) {
        if (state.machineState === MachineState.Bidding) {
            state = run(state, {})
        } else {
            const due = state.freeBuild
            assertExists(due, 'Free build due')
            const linkId = homeLinks(hydrate(state), VELD.home(due.railroadId)).find(
                (id) => VELD.link(id).oneWayFrom === undefined
            )
            assertExists(linkId, 'A two-way home link')
            state = run(state, {
                type: ActionType.BuildTrack,
                railroadId: due.railroadId,
                linkIds: [linkId]
            })
        }
    }
    return state
}

function railroad(state: SarGameState, railroadId: RailroadId) {
    const found = state.railroads.find((candidate) => candidate.id === railroadId)
    assertExists(found, `No ${railroadId}`)
    return found
}

// The CdFM reaches Pretoria, one link from Johannesburg, with money to build.
function cdfmBesideJohannesburg(state: SarGameState): SarGameState {
    state.track.push({ linkId: 'pienaarsriver~pretoria', railroadId: RailroadId.CdFM })
    railroad(state, RailroadId.CdFM).treasury = 50
    return state
}

describe('the Veld Railroads setup', () => {
    it('starts each treasury with a die roll, doubled for the ZASM', () => {
        const state = started()
        for (const entry of state.railroads) {
            const range = entry.id === RailroadId.ZASM ? [2, 12] : [1, 6]
            expect(entry.treasury).toBeGreaterThanOrEqual(range[0])
            expect(entry.treasury).toBeLessThanOrEqual(range[1])
        }
        expect(railroad(state, RailroadId.ZASM).treasury % 2).toBe(0)
    })

    it('plays eight rounds, the eighth ending in the final payoff', () => {
        const state = hydrate(afterInitialOffering())
        expect(state.rounds()).toBe(8)
        state.dividendsPaid = 6
        expect(state.isFinalPayoffNext()).toBe(false)
        state.dividendsPaid = 7
        expect(state.round()).toBe(8)
        expect(state.isFinalPayoffNext()).toBe(true)
    })
})

describe('Veld Railroads track', () => {
    it('keeps each closed border shut until its dividend has been paid', () => {
        const borders = VELD.definition.closedBorders ?? []
        expect(borders.map((border) => [border.opensAfterDividend, border.linkIds.length])).toEqual(
            [
                [1, 2],
                [2, 5],
                [3, 3]
            ]
        )
        const state = hydrate(cdfmBesideJohannesburg(afterInitialOffering()))
        state.track.push({ linkId: 'johannesburg~pretoria', railroadId: RailroadId.CdFM })
        expect(state.singleBuilds(RailroadId.CdFM)).not.toContain('johannesburg~vereeniging')
        state.dividendsPaid = 2
        expect(state.singleBuilds(RailroadId.CdFM)).toContain('johannesburg~vereeniging')
    })

    it('builds a one-way link only from the end its arrow leaves', () => {
        const state = hydrate(afterInitialOffering())
        expect(homeLinks(state, 'aliwal-north')).toContain('aliwal-north~dreunberg')
        state.track.push({ linkId: 'dreunberg~springfontein', railroadId: RailroadId.CMRC })
        state.railroad(RailroadId.CMRC).treasury = 50
        expect(state.singleBuilds(RailroadId.CMRC)).not.toContain('aliwal-north~dreunberg')
        expect(
            state
                .doubleBuilds(RailroadId.CMRC)
                .some((pair) => pair.includes('aliwal-north~dreunberg'))
        ).toBe(false)
    })

    it('pays special dividends rounded up, the first link into Johannesburg earning one', () => {
        let state = cdfmBesideJohannesburg(afterInitialOffering())
        const cash = hydrate(state).getPlayerState('a').cash
        state = run(state, { type: ActionType.ChooseAction, box: ActionBox.ConstructTrack })
        state = run(state, {
            type: ActionType.BuildTrack,
            railroadId: RailroadId.CdFM,
            linkIds: ['johannesburg~pretoria']
        })
        const hydrated = hydrate(state)
        const income = hydrated.income(RailroadId.CdFM)
        expect(income % 5).not.toBe(0)
        // a holds the CdFM's one sold share.
        expect(hydrated.getPlayerState('a').cash).toBe(cash + Math.ceil(income / 5))
        // The build reached the ZASM's home, so the ZASM's share is up for auction.
        expect(state.machineState).toBe(MachineState.Bidding)
        expect(state.auction?.railroadId).toBe(RailroadId.ZASM)
    })
})

describe('the Veld Railroads ZASM', () => {
    it('opens once Johannesburg’s income reaches $6', () => {
        let state = afterInitialOffering()
        state.developments.johannesburg = 3
        state = run(state, { type: ActionType.ChooseAction, box: ActionBox.DevelopSettlements })
        state = run(state, { type: ActionType.Develop, settlementId: 'johannesburg' })
        expect(state.machineState).toBe(MachineState.DevelopingSettlements)
        state = run(state, { type: ActionType.FinishDevelopment })
        expect(hydrate(state).settlementIncome('johannesburg')).toBe(7)
        expect(state.machineState).toBe(MachineState.Bidding)
        expect(state.auction?.railroadId).toBe(RailroadId.ZASM)
    })

    it('pays double until its track meets another railroad’s', () => {
        const state = hydrate(afterInitialOffering())
        const zasm = state.railroad(RailroadId.ZASM)
        zasm.owners = ['a']
        zasm.treasury = 50
        state.track.push({ linkId: 'johannesburg~pretoria', railroadId: RailroadId.ZASM })
        expect(state.linkCost(RailroadId.ZASM)).toBe(10)
        expect(state.doubleLinkCost(RailroadId.ZASM)).toBe(30)
        state.track.push({ linkId: 'pienaarsriver~pretoria', railroadId: RailroadId.CdFM })
        expect(state.linkCost(RailroadId.ZASM)).toBe(5)
        expect(state.doubleLinkCost(RailroadId.ZASM)).toBe(15)
    })

    it('earns a special dividend when its track first meets another’s, while none reaches Johannesburg', () => {
        let state = cdfmBesideJohannesburg(afterInitialOffering())
        const zasm = railroad(state, RailroadId.ZASM)
        zasm.owners = ['b']
        state.track.push({ linkId: 'johannesburg~magaliesburg', railroadId: RailroadId.ZASM })
        state = run(state, { type: ActionType.ChooseAction, box: ActionBox.ConstructTrack })
        state = run(state, {
            type: ActionType.BuildTrack,
            railroadId: RailroadId.CdFM,
            linkIds: ['magaliesburg~pretoria']
        })
        const b = state.players.find((player) => player.playerId === 'b')
        assertExists(b, 'b plays')
        const perShare = hydrate(state).specialDividendPerShare(RailroadId.ZASM)
        expect(perShare).toBeGreaterThan(0)
        expect(b.cash).toBe(VELD.startingCash(4) + perShare)
    })
})

describe('the Veld Railroads war and recovery', () => {
    it('makes round 4 a war: $7 single links, no doubles or connections, the ZASM halted', () => {
        const state = hydrate(cdfmBesideJohannesburg(afterInitialOffering()))
        state.dividendsPaid = 3
        expect(state.war()).toBeDefined()
        expect(state.linkCost(RailroadId.CdFM)).toBe(7)
        expect(state.doubleBuilds(RailroadId.CdFM)).toEqual([])
        state.track.push({ linkId: 'mafeking~vryburg', railroadId: RailroadId.CdFM })
        expect(state.connectionBuilds(RailroadId.CdFM)).toEqual([])
        state.dividendsPaid = 4
        expect(state.connectionBuilds(RailroadId.CdFM).map((entry) => entry.id)).toContain(
            'bechuanaland'
        )
        state.dividendsPaid = 3
        const zasm = state.railroad(RailroadId.ZASM)
        zasm.owners = ['a']
        zasm.treasury = 50
        state.track.push({ linkId: 'bethal~johannesburg', railroadId: RailroadId.ZASM })
        expect(state.singleBuilds(RailroadId.ZASM)).toEqual([])
    })

    it('allows three developments in the war, the first two free', () => {
        let state = afterInitialOffering()
        state.dividendsPaid = 3
        state = run(state, { type: ActionType.ChooseAction, box: ActionBox.DevelopSettlements })
        const [first] = hydrate(state)
            .affordableDevelopments('a')
            .filter((id) => id !== 'johannesburg')
        state = run(state, { type: ActionType.Develop, settlementId: first })
        const second = hydrate(state)
        expect(second.mayFinishDeveloping()).toBe(false)
        const [next] = second.affordableDevelopments('a').filter((id) => id !== 'johannesburg')
        expect(second.developmentCost(next)).toBe(0)
        state = run(state, { type: ActionType.Develop, settlementId: next })
        const third = hydrate(state)
        expect(third.mayFinishDeveloping()).toBe(true)
        expect(third.developmentCost(first)).toBe(3)
        expect(third.developmentCost('johannesburg')).toBe(0)
        state = run(state, { type: ActionType.FinishDevelopment })
        expect(hydrate(state).developmentLevel('johannesburg')).toBe(1)
        expect(state.machineState).toBe(MachineState.ChoosingAction)
    })

    it('pays every dividend in round 5 at income ÷ 10, rounded down', () => {
        const state = hydrate(cdfmBesideJohannesburg(afterInitialOffering()))
        state.dividendsPaid = 4
        const income = state.income(RailroadId.CdFM)
        expect(income % 10).not.toBe(0)
        expect(state.dividendPerShare(RailroadId.CdFM)).toBe(Math.floor(income / 10))
        expect(state.specialDividendPerShare(RailroadId.CdFM)).toBe(Math.floor(income / 10))
        state.dividendsPaid = 5
        expect(state.dividendPerShare(RailroadId.CdFM)).toBe(Math.ceil(income / 5))
    })
})
