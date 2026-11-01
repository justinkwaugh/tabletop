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

const OLD_FRONTIER = sarMap(MapId.OldFrontier)
const engine = new GameEngine(SarRuntime)
const game = SarRuntime.initializer.initializeGame(
    {
        id: 'old-frontier-rules',
        typeId: Definition.info.id,
        ownerId: 'owner',
        config: { map: MapId.OldFrontier },
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

// Every opening share goes unbid to its opener, a, who builds the first home link listed.
function afterInitialOffering(): SarGameState {
    let state = started()
    while (state.machineState !== MachineState.ChoosingAction) {
        if (state.machineState === MachineState.Bidding) {
            state = run(state, {})
        } else {
            const due = state.freeBuild
            assertExists(due, 'Free build due')
            const linkId = homeLinks(hydrate(state), OLD_FRONTIER.home(due.railroadId))[0]
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

// The Black reaches Mercantile Center 3, one link from The Center, with money to build.
function blackBesideTheCenter(state: SarGameState): SarGameState {
    state.track.push({ linkId: 'market-3~station-40', railroadId: RailroadId.Black })
    railroad(state, RailroadId.Black).treasury = 50
    return state
}

describe('the Old Frontier Railroads setup', () => {
    it('starts each treasury with a die roll, doubled for the Yellow', () => {
        const state = started()
        for (const entry of state.railroads) {
            const range = entry.id === RailroadId.Yellow ? [2, 12] : [1, 6]
            expect(entry.treasury).toBeGreaterThanOrEqual(range[0])
            expect(entry.treasury).toBeLessThanOrEqual(range[1])
        }
        expect(railroad(state, RailroadId.Yellow).treasury % 2).toBe(0)
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

describe('Old Frontier Railroads track', () => {
    it('keeps each closed border shut until its dividend has been paid', () => {
        const borders = OLD_FRONTIER.definition.closedBorders ?? []
        expect(borders.map((border) => [border.opensAfterDividend, border.linkIds.length])).toEqual(
            [
                [1, 2],
                [2, 5],
                [3, 3]
            ]
        )
        const state = hydrate(blackBesideTheCenter(afterInitialOffering()))
        state.track.push({ linkId: 'center~market-3', railroadId: RailroadId.Black })
        expect(state.singleBuilds(RailroadId.Black)).not.toContain('center~market-2')
        state.dividendsPaid = 2
        expect(state.singleBuilds(RailroadId.Black)).toContain('center~market-2')
    })

    it('builds a one-way link only from the end its arrow leaves', () => {
        const state = hydrate(afterInitialOffering())
        expect(homeLinks(state, 'green-base')).toContain('green-base~station-3')
        state.track.push({ linkId: 'station-3~station-8', railroadId: RailroadId.Red })
        state.railroad(RailroadId.Red).treasury = 50
        expect(state.singleBuilds(RailroadId.Red)).not.toContain('green-base~station-3')
        expect(
            state.doubleBuilds(RailroadId.Red).some((pair) => pair.includes('green-base~station-3'))
        ).toBe(false)
    })

    it('pays special dividends rounded up, the first link into The Center earning one', () => {
        let state = blackBesideTheCenter(afterInitialOffering())
        const cash = hydrate(state).getPlayerState('a').cash
        state = run(state, { type: ActionType.ChooseAction, box: ActionBox.ConstructTrack })
        state = run(state, {
            type: ActionType.BuildTrack,
            railroadId: RailroadId.Black,
            linkIds: ['center~market-3']
        })
        const hydrated = hydrate(state)
        const income = hydrated.income(RailroadId.Black)
        expect(income % 5).not.toBe(0)
        // a holds the Black's one sold share.
        expect(hydrated.getPlayerState('a').cash).toBe(cash + Math.ceil(income / 5))
        // The build reached the Yellow's home, so the Yellow's share is up for auction.
        expect(state.machineState).toBe(MachineState.Bidding)
        expect(state.auction?.railroadId).toBe(RailroadId.Yellow)
    })
})

describe('the Old Frontier Railroads Yellow', () => {
    it('opens once The Center’s income reaches $6', () => {
        let state = afterInitialOffering()
        state.developments.center = 3
        state = run(state, { type: ActionType.ChooseAction, box: ActionBox.DevelopSettlements })
        state = run(state, { type: ActionType.Develop, settlementId: 'center' })
        expect(state.machineState).toBe(MachineState.DevelopingSettlements)
        state = run(state, { type: ActionType.FinishDevelopment })
        expect(hydrate(state).settlementIncome('center')).toBe(7)
        expect(state.machineState).toBe(MachineState.Bidding)
        expect(state.auction?.railroadId).toBe(RailroadId.Yellow)
    })

    it('pays double until its track meets another railroad’s', () => {
        const state = hydrate(afterInitialOffering())
        const yellow = state.railroad(RailroadId.Yellow)
        yellow.open = true
        yellow.owners = ['a']
        yellow.treasury = 50
        state.track.push({ linkId: 'center~market-3', railroadId: RailroadId.Yellow })
        expect(state.linkCost(RailroadId.Yellow)).toBe(10)
        expect(state.doubleLinkCost(RailroadId.Yellow)).toBe(30)
        state.track.push({ linkId: 'market-3~station-40', railroadId: RailroadId.Black })
        expect(state.linkCost(RailroadId.Yellow)).toBe(5)
        expect(state.doubleLinkCost(RailroadId.Yellow)).toBe(15)
    })

    it('earns a special dividend when its track first meets another’s, while none reaches The Center', () => {
        let state = blackBesideTheCenter(afterInitialOffering())
        const yellow = railroad(state, RailroadId.Yellow)
        yellow.open = true
        yellow.owners = ['b']
        state.track.push({ linkId: 'center~station-39', railroadId: RailroadId.Yellow })
        state = run(state, { type: ActionType.ChooseAction, box: ActionBox.ConstructTrack })
        state = run(state, {
            type: ActionType.BuildTrack,
            railroadId: RailroadId.Black,
            linkIds: ['market-3~station-39']
        })
        const b = state.players.find((player) => player.playerId === 'b')
        assertExists(b, 'b plays')
        const perShare = hydrate(state).specialDividendPerShare(RailroadId.Yellow)
        expect(perShare).toBeGreaterThan(0)
        expect(b.cash).toBe(OLD_FRONTIER.startingCash(4) + perShare)
    })
})

describe('the Old Frontier Railroads war and recovery', () => {
    it('makes round 4 a war: $7 single links, no doubles or connections, the Yellow halted', () => {
        const state = hydrate(blackBesideTheCenter(afterInitialOffering()))
        state.dividendsPaid = 3
        expect(state.war()).toBeDefined()
        expect(state.linkCost(RailroadId.Black)).toBe(7)
        expect(state.doubleBuilds(RailroadId.Black)).toEqual([])
        state.track.push({ linkId: 'station-48~station-49', railroadId: RailroadId.Black })
        expect(state.connectionBuilds(RailroadId.Black)).toEqual([])
        state.dividendsPaid = 4
        expect(state.connectionBuilds(RailroadId.Black).map((entry) => entry.id)).toContain(
            'south-frontier'
        )
        state.dividendsPaid = 3
        const yellow = state.railroad(RailroadId.Yellow)
        yellow.open = true
        yellow.treasury = 50
        state.track.push({ linkId: 'center~station-24', railroadId: RailroadId.Yellow })
        expect(state.singleBuilds(RailroadId.Yellow)).toEqual([])
    })

    it('allows three developments in the war, the first two free', () => {
        let state = afterInitialOffering()
        state.dividendsPaid = 3
        state = run(state, { type: ActionType.ChooseAction, box: ActionBox.DevelopSettlements })
        const [first] = hydrate(state)
            .affordableDevelopments('a')
            .filter((id) => id !== 'center')
        state = run(state, { type: ActionType.Develop, settlementId: first })
        const second = hydrate(state)
        expect(second.mayFinishDeveloping()).toBe(false)
        const [next] = second.affordableDevelopments('a').filter((id) => id !== 'center')
        expect(second.developmentCost(next)).toBe(0)
        state = run(state, { type: ActionType.Develop, settlementId: next })
        const third = hydrate(state)
        expect(third.mayFinishDeveloping()).toBe(true)
        expect(third.developmentCost(first)).toBe(3)
        expect(third.developmentCost('center')).toBe(0)
        state = run(state, { type: ActionType.FinishDevelopment })
        expect(hydrate(state).developmentLevel('center')).toBe(1)
        expect(state.machineState).toBe(MachineState.ChoosingAction)
    })

    it('pays every dividend in round 5 at income ÷ 10, rounded down', () => {
        const state = hydrate(blackBesideTheCenter(afterInitialOffering()))
        state.dividendsPaid = 4
        const income = state.income(RailroadId.Black)
        expect(income % 10).not.toBe(0)
        expect(state.dividendPerShare(RailroadId.Black)).toBe(Math.floor(income / 10))
        expect(state.specialDividendPerShare(RailroadId.Black)).toBe(Math.floor(income / 10))
        state.dividendsPaid = 5
        expect(state.dividendPerShare(RailroadId.Black)).toBe(Math.ceil(income / 5))
    })
})
