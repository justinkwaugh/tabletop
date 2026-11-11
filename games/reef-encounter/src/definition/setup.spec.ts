import { assert, Visibility } from '@tabletop/common'
import { describe, expect, it } from 'vitest'
import { CoralColor, CoralColors, totalCount } from '../components/colors.js'
import {
    isParrotfishFed,
    ParrotfishFeedingGroupId,
    ReefEncounterGameStateValidator,
    type ReefEncounterProjectedState
} from '../model/gameState.js'
import {
    chooseEveryLarvaCube,
    dealtColorOf,
    feedEveryParrotfish,
    startTestGame,
    type TestSession
} from '../util/testHelper.js'
import type { ReefEncounterGameConfig } from './config.js'
import { ActionType } from './actions.js'
import { ReefEncounterRuntime } from './runtime.js'
import { MachineState } from './states.js'

const spectator = { kind: 'spectator' } as const

function asPlayer(playerId: string) {
    return { kind: 'player', playerId } as const
}

function project(
    session: TestSession,
    perspective: Visibility.Perspective
): ReefEncounterProjectedState {
    assert(
        ReefEncounterGameStateValidator.Check(session.state),
        'Projection starts from canonical state'
    )
    return ReefEncounterRuntime.visibility.state.project(session.state, perspective, {
        config: session.game.config
    })
}

function startSession(config: Partial<ReefEncounterGameConfig> = {}) {
    return startTestGame(3, config)
}

describe('feeding the parrotfish at setup', () => {
    it('lets everyone feed at once, in any order', () => {
        const session = startSession()
        const [first, second, third] = session.state.turnManager.turnOrder
        expect(session.state.activePlayerIds).toEqual([first, second, third])

        session.feedParrotfish(third, dealtColorOf(session, third))
        expect(session.state.activePlayerIds).toEqual([first, second])
        session.feedParrotfish(first, dealtColorOf(session, first))
        expect(session.state.activePlayerIds).toEqual([second])
        session.feedParrotfish(second, dealtColorOf(session, second))

        expect(session.state.machineState).toBe(MachineState.ChoosingLarvaCubes)
        expect(session.state.activePlayerIds).toEqual([first])
    })

    it('accepts a feed submitted before another player’s was recorded', () => {
        const session = startSession()
        const [first, second] = session.state.turnManager.turnOrder
        session.feedParrotfish(first, dealtColorOf(session, first))

        session.act(second, ActionType.FeedParrotfish, {
            color: dealtColorOf(session, second),
            index: 0,
            simultaneousGroupId: ParrotfishFeedingGroupId
        })

        expect(session.state.activePlayerIds).not.toContain(second)
    })

    it('shows who has fed, but not what', () => {
        const session = startSession()
        const [first, second] = session.state.turnManager.turnOrder
        session.feedParrotfish(second, dealtColorOf(session, second))

        const asFirst = project(session, asPlayer(first))
        expect(isParrotfishFed(asFirst, first)).toBe(false)
        expect(isParrotfishFed(asFirst, second)).toBe(true)
    })

    it('goes on in turn order in a game begun before feeding was simultaneous', () => {
        const session = startSession()
        const [first, second, third] = session.state.turnManager.turnOrder
        session.edit((draft) => {
            draft.turnManager.series = [{ type: 'turn', playerId: first, start: 0 }]
            draft.activePlayerIds = [first]
        })
        expect(isParrotfishFed(session.state, second)).toBe(false)

        expect(() => session.feedParrotfish(second, dealtColorOf(session, second))).toThrow()
        session.feedParrotfish(first, dealtColorOf(session, first))
        expect(session.state.activePlayerIds).toEqual([second])
        expect(isParrotfishFed(session.state, first)).toBe(true)
        expect(isParrotfishFed(session.state, third)).toBe(false)
        session.feedParrotfish(second, dealtColorOf(session, second))
        session.feedParrotfish(third, dealtColorOf(session, third))

        expect(session.state.machineState).toBe(MachineState.ChoosingLarvaCubes)
        expect(session.state.activePlayerIds).toEqual([first])
    })

    it('moves one dealt polyp from the supply into the parrotfish', () => {
        const session = startSession()
        const first = session.currentPlayerId()
        const color = dealtColorOf(session, first)
        const before = session.hydrated().getPlayerState(first).getSecretSupplyPolyps()[color]

        session.feedParrotfish(first, color)

        const player = session.hydrated().getPlayerState(first)
        expect(player.getSecretSupplyPolyps()[color]).toBe(before - 1)
        expect(player.getSecretParrotfishPolyps()).toMatchObject({ [color]: 1 })
        expect(totalCount(player.getSecretParrotfishPolyps())).toBe(1)
    })

    it('rejects a colour the player was not dealt', () => {
        const session = startSession()
        const first = session.currentPlayerId()
        const polyps = session.hydrated().getPlayerState(first).getSecretSupplyPolyps()
        const missing = CoralColors.find((color) => polyps[color] === 0)
        assert(missing, 'The test seed deals the start player fewer than five colours')

        expect(() => session.feedParrotfish(first, missing)).toThrow()
    })

    it('accepts one feed from each player', () => {
        const session = startSession()
        const first = session.currentPlayerId()
        session.feedParrotfish(first, dealtColorOf(session, first))

        expect(() => session.feedParrotfish(first, dealtColorOf(session, first))).toThrow()
    })
})

describe('choosing larva cubes at setup', () => {
    it('gives each player two cubes from the supply, in turn order', () => {
        const session = startSession()
        feedEveryParrotfish(session)
        const [first, second] = session.state.turnManager.turnOrder

        session.chooseLarvaCubes(first, [CoralColor.White, CoralColor.White])

        const player = session.hydrated().getPlayerState(first)
        expect(player.getLarvaCubes()).toMatchObject({ [CoralColor.White]: 2 })
        expect(session.state.larvaCubeSupply[CoralColor.White]).toBe(7)
        expect(session.state.activePlayerIds).toEqual([second])
    })

    it('rejects anything but two cubes the supply holds', () => {
        const session = startSession()
        feedEveryParrotfish(session)
        const first = session.currentPlayerId()

        expect(() => session.chooseLarvaCubes(first, [CoralColor.White])).toThrow()
        expect(() =>
            session.chooseLarvaCubes(first, [CoralColor.White, CoralColor.Grey, CoralColor.Pink])
        ).toThrow()
    })

    it('starts the first turn with the start player once everyone has chosen', () => {
        const session = startSession()
        feedEveryParrotfish(session)
        chooseEveryLarvaCube(session)

        expect(session.state.machineState).toBe(MachineState.TakingTurn)
        expect(session.state.activePlayerIds).toEqual([session.state.turnManager.turnOrder[0]])
    })
})

describe('what each player sees during setup', () => {
    it('keeps every dealt polyp and parrotfish polyp from everyone but its owner', () => {
        const session = startSession()
        feedEveryParrotfish(session)
        const [first, second] = session.state.turnManager.turnOrder

        const asFirst = project(session, asPlayer(first))
        const own = asFirst.players.find((player) => player.playerId === first)
        const other = asFirst.players.find((player) => player.playerId === second)
        expect(own?.secretSupplyPolyps).toBeDefined()
        expect(own?.secretParrotfishPolyps).toBeDefined()
        expect(other?.secretSupplyPolyps).toBeUndefined()
        expect(other?.secretParrotfishPolyps).toBeUndefined()

        for (const player of project(session, spectator).players) {
            expect(player.secretSupplyPolyps).toBeUndefined()
            expect(player.secretParrotfishPolyps).toBeUndefined()
        }
    })

    it('hides which colour another player fed their parrotfish', () => {
        const session = startSession()
        const first = session.currentPlayerId()
        const [, second] = session.state.turnManager.turnOrder
        const color = dealtColorOf(session, first)
        session.feedParrotfish(first, color)
        const feed = session.actions.find((action) => action.type === ActionType.FeedParrotfish)
        assert(feed, 'The feed was recorded')
        const projectFeed = (perspective: Visibility.Perspective) =>
            ReefEncounterRuntime.visibility.actions.project(feed, perspective, {
                config: session.game.config
            })

        expect(projectFeed(asPlayer(first))).toMatchObject({ color })
        expect(projectFeed(asPlayer(second))).not.toHaveProperty('color')
        expect(projectFeed(spectator)).not.toHaveProperty('color')
    })

    it('hides the bag order from everyone', () => {
        const session = startSession()
        const view = project(session, asPlayer(session.currentPlayerId()))
        expect(view.polypBag.items).toEqual([])
        expect(view.polypBag.remaining).toBe(session.state.polypBag.remaining)
    })

    it('shows larva cubes, shrimps and eaten polyps openly unless Concealed, and the setup deal and feed never', () => {
        const open = startSession()
        feedEveryParrotfish(open)
        chooseEveryLarvaCube(open)
        const concealed = startSession({ concealed: true })
        feedEveryParrotfish(concealed)
        chooseEveryLarvaCube(concealed)
        const [first, second] = open.state.turnManager.turnOrder

        const seenOpenly = project(open, asPlayer(first)).players.find((p) => p.playerId === second)
        expect(seenOpenly?.larvaCubes).toMatchObject({ [CoralColor.Pink]: 1, [CoralColor.Grey]: 1 })
        expect(seenOpenly?.shrimpsInSupply).toBe(4)
        expect(seenOpenly?.knownParrotfishPolyps).toBeDefined()
        expect(seenOpenly?.shrimpsInParrotfish).toBe(0)
        expect(seenOpenly?.secretSupplyPolyps).toBeUndefined()
        expect(seenOpenly?.secretParrotfishPolyps).toBeUndefined()

        const seenConcealed = project(concealed, asPlayer(first)).players.find(
            (p) => p.playerId === second
        )
        expect(seenConcealed?.larvaCubes).toBeUndefined()
        expect(seenConcealed?.shrimpsInSupply).toBeUndefined()
        expect(seenConcealed?.knownParrotfishPolyps).toBeUndefined()
        expect(seenConcealed?.shrimpsInParrotfish).toBeUndefined()
        expect(seenConcealed?.shrimpOnOpenSea).toBe(false)
        expect(seenConcealed?.secretSupplyPolyps).toBeUndefined()
        expect(seenConcealed?.secretParrotfishPolyps).toBeUndefined()
        expect(
            project(concealed, asPlayer(second)).players.find((p) => p.playerId === second)
                ?.larvaCubes
        ).toBeDefined()
    })
})
