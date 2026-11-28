import { describe, expect, it } from 'vitest'
import {
    ActionSource,
    GameEngine,
    GameResult,
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

const PAMPAS = sarMap(MapId.Pampas)
const engine = new GameEngine(SarRuntime)
const game = SarRuntime.initializer.initializeGame(
    {
        id: 'pampas-rules',
        typeId: Definition.info.id,
        ownerId: 'owner',
        config: { map: MapId.Pampas },
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
        id: `p${step++}`,
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

// Every opening share goes unbid to its opener, a, who builds the first link offered.
function afterInitialOffering(): SarGameState {
    let state = started()
    while (state.machineState !== MachineState.ChoosingAction) {
        if (state.machineState === MachineState.Bidding) {
            state = run(state, {})
        } else {
            const due = state.freeBuild
            assertExists(due, 'Free build due')
            const [linkId] = hydrate(state).freeLinkOptions(due.railroadId)
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

function choose(state: SarGameState, box: ActionBox, special = false): SarGameState {
    return run(state, { type: ActionType.ChooseAction, box, ...(special ? { special } : {}) })
}

// Offers an unsold railroad share that nobody buys.
function offerUnsold(state: SarGameState, special = false): SarGameState {
    let next = choose(state, ActionBox.OfferStock, special)
    const [railroadId] = hydrate(next).unsoldOffers()
    next = run(next, { type: ActionType.OfferShare, railroadId, ownShare: false })
    while (next.machineState === MachineState.Bidding) {
        next = run(next, {})
    }
    return next
}

function developOnce(state: SarGameState): SarGameState {
    let next = choose(state, ActionBox.DevelopSettlements)
    const [settlementId] = hydrate(next).developableSettlements()
    next = run(next, { type: ActionType.Develop, settlementId })
    return run(next, { type: ActionType.FinishDevelopment })
}

const FULL_DEVELOP_ROW = { [ActionBox.DevelopSettlements]: 4 }

describe('Pampas Railroads', () => {
    it('starts each opening railroad on a Buenos Aires link printed in its colour', () => {
        const state = started()
        expect(hydrate(state).freeLinkOptions(RailroadId.BAGS).toSorted()).toEqual([
            'buenos-aires~las-flores',
            'buenos-aires~maipu'
        ])
        const opened = afterInitialOffering()
        expect(opened.track.map((built) => [built.railroadId, built.linkId])).toEqual([
            [RailroadId.BAGS, 'buenos-aires~las-flores'],
            [RailroadId.NA, 'buenos-aires~san-nicolas'],
            [RailroadId.BAP, 'buenos-aires~mercedes'],
            [RailroadId.BAW, 'buenos-aires~lobos'],
            [RailroadId.CA, 'buenos-aires~la-plata']
        ])
    })

    it('gives the first turn to the buyer of the Central Argentine share', () => {
        const state = hydrate(afterInitialOffering())
        expect(state.turnPlayerId()).toBe('a')
        expect(state.rowsFilled).toEqual({})
        expect(state.players.every((player) => player.specialActionUsed === false)).toBe(true)
    })

    it('fills a box per action and pays dividends once two rows are full', () => {
        let state = afterInitialOffering()
        for (let index = 0; index < 3; index++) {
            state = offerUnsold(state)
        }
        expect(hydrate(state).availableBoxes(hydrate(state).turnPlayerId())).toEqual([
            ActionBox.ConstructTrack,
            ActionBox.DevelopSettlements
        ])
        for (let index = 0; index < 3; index++) {
            state = developOnce(state)
        }
        expect(state.dividendsPaid).toBe(0)
        expect(hydrate(state).triggersDividends(ActionBox.DevelopSettlements)).toBe(true)
        expect(hydrate(state).triggersDividends(ActionBox.ConstructTrack)).toBe(false)
        state = developOnce(state)
        expect(state.dividendsPaid).toBe(1)
        expect(state.rowsFilled).toEqual({})
    })

    it('continues with the next player after a dividend', () => {
        let state = afterInitialOffering()
        state.rowsFilled = { ...FULL_DEVELOP_ROW, [ActionBox.OfferStock]: 1 }
        state = offerUnsold(state)
        expect(hydrate(state).turnPlayerId()).toBe('b')
        state = offerUnsold(state)
        expect(state.dividendsPaid).toBe(1)
        expect(hydrate(state).turnPlayerId()).toBe('c')
    })

    it('lets the special action take a full row once, filling no box', () => {
        let state = afterInitialOffering()
        state.rowsFilled = { [ActionBox.OfferStock]: 3 }
        expect(hydrate(state).availableBoxes('a')).not.toContain(ActionBox.OfferStock)
        expect(hydrate(state).specialActionBoxes('a')).toContain(ActionBox.OfferStock)
        state = offerUnsold(state, true)
        expect(state.rowsFilled).toEqual({ [ActionBox.OfferStock]: 3 })
        const player = state.players.find((candidate) => candidate.playerId === 'a')
        expect(player?.specialActionUsed).toBe(true)
        expect(hydrate(state).specialActionBoxes('a')).toEqual([])
    })

    it('lets the turn player build where the largest holding is shared', () => {
        let state = afterInitialOffering()
        railroad(state, RailroadId.NA).owners = ['c', 'd']
        railroad(state, RailroadId.NA).treasury = 10
        state = choose(state, ActionBox.ConstructTrack)
        expect(hydrate(state).ownBuildableRailroads('a')).toContain(RailroadId.NA)
        state = run(state, {
            type: ActionType.BuildTrack,
            railroadId: RailroadId.NA,
            linkIds: ['rosario~san-nicolas']
        })
        expect(railroad(state, RailroadId.NA).treasury).toBe(5)
    })

    it('lets the largest shareholder build for whoever chooses the railroad', () => {
        let state = afterInitialOffering()
        railroad(state, RailroadId.NA).owners = ['b', 'b']
        railroad(state, RailroadId.NA).treasury = 10
        railroad(state, RailroadId.CA).treasury = 10
        state = choose(state, ActionBox.ConstructTrack)
        expect(hydrate(state).ownBuildableRailroads('a')).toContain(RailroadId.CA)
        expect(hydrate(state).delegableRailroads('a')).toContain(RailroadId.NA)
        state = run(state, {
            type: ActionType.DelegateBuild,
            railroadId: RailroadId.NA,
            builderId: 'b'
        })
        expect(state.machineState).toBe(MachineState.DelegatedBuild)
        expect(state.activePlayerIds).toEqual(['b'])
        state = run(state, {
            type: ActionType.BuildTrack,
            railroadId: RailroadId.NA,
            linkIds: ['rosario~san-nicolas']
        })
        expect(railroad(state, RailroadId.NA).treasury).toBe(5)
    })

    it('opens the Córdoba & Rosario once track reaches Córdoba', () => {
        let state = afterInitialOffering()
        state.track.push(
            { linkId: 'buenos-aires~pergamino', railroadId: RailroadId.BAP },
            { linkId: 'pergamino~venado-tuerto', railroadId: RailroadId.BAP },
            { linkId: 'rio-cuarto~venado-tuerto', railroadId: RailroadId.BAP }
        )
        railroad(state, RailroadId.BAP).treasury = 20
        state = choose(state, ActionBox.ConstructTrack)
        state = run(state, {
            type: ActionType.BuildTrack,
            railroadId: RailroadId.BAP,
            linkIds: ['cordoba~rio-cuarto']
        })
        expect(state.machineState).toBe(MachineState.Bidding)
        expect(state.auction?.railroadId).toBe(RailroadId.CR)
        while (state.machineState === MachineState.Bidding) {
            state = run(state, {})
        }
        expect(state.machineState).toBe(MachineState.FreeBuild)
        expect(hydrate(state).freeLinkOptions(RailroadId.CR).toSorted()).toEqual([
            'cordoba~cruz-del-eje',
            'cordoba~dean-funes'
        ])
    })

    it('keeps Buenos Aires the highest metro area and Tucumán the lowest', () => {
        const state = hydrate(afterInitialOffering())
        state.track.push(
            { linkId: 'rosario-de-la-frontera~tucuman', railroadId: RailroadId.NA },
            { linkId: 'cordoba~san-francisco', railroadId: RailroadId.NA },
            { linkId: 'rosario~san-nicolas', railroadId: RailroadId.NA }
        )
        expect(state.developableSettlements()).not.toContain('tucuman')
        state.developments.cordoba = 2
        expect(state.developableSettlements()).not.toContain('tucuman')
        state.developments.rosario = 1
        expect(state.developableSettlements()).toContain('tucuman')
        expect(state.developableSettlements()).not.toContain('cordoba')
        state.developments['buenos-aires'] = 1
        expect(state.developableSettlements()).toContain('cordoba')
    })

    it('breaks a tie on money by shares of the most valuable railroad', () => {
        let state = afterInitialOffering()
        // a's final payoff is $15, b's $14.
        for (const player of state.players) {
            player.cash = player.playerId === 'b' ? 1 : 0
        }
        railroad(state, RailroadId.BAGS).owners = ['a', 'b', 'b']
        railroad(state, RailroadId.NA).owners = ['a', 'a', 'c']
        state.track.push({ linkId: 'las-flores~tandil', railroadId: RailroadId.BAGS })
        for (const other of [RailroadId.BAP, RailroadId.BAW, RailroadId.CA]) {
            railroad(state, other).owners = []
        }
        state.dividendsPaid = PAMPAS.definition.dividendsBeforeFinal
        state.rowsFilled = { ...FULL_DEVELOP_ROW, [ActionBox.OfferStock]: 2 }
        state = offerUnsold(state)
        expect(state.machineState).toBe(MachineState.EndOfGame)
        const cash = (playerId: string) =>
            state.players.find((player) => player.playerId === playerId)?.cash
        expect(cash('a')).toBe(cash('b'))
        expect(state.result).toBe(GameResult.Win)
        expect(state.winningPlayerIds).toEqual(['b'])
    })
})
