import { assert, Visibility } from '@tabletop/common'
import { describe, expect, it } from 'vitest'
import { CoralColor, CoralColors, totalCount } from '../components/colors.js'
import {
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
    it('goes round the table in turn order', () => {
        const session = startSession()
        const [first, second, third] = session.state.turnManager.turnOrder

        session.feedParrotfish(first, dealtColorOf(session, first))
        expect(session.state.activePlayerIds).toEqual([second])
        session.feedParrotfish(second, dealtColorOf(session, second))
        expect(session.state.activePlayerIds).toEqual([third])
        session.feedParrotfish(third, dealtColorOf(session, third))

        expect(session.state.machineState).toBe(MachineState.ChoosingLarvaCubes)
        expect(session.state.activePlayerIds).toEqual([first])
    })

    it('moves one dealt polyp behind the screen into the parrotfish', () => {
        const session = startSession()
        const first = session.currentPlayerId()
        const color = dealtColorOf(session, first)
        const before = session.hydrated().getPlayerState(first).getSecretScreenPolyps()[color]

        session.feedParrotfish(first, color)

        const player = session.hydrated().getPlayerState(first)
        expect(player.getSecretScreenPolyps()[color]).toBe(before - 1)
        expect(player.getSecretParrotfishPolyps()).toMatchObject({ [color]: 1 })
        expect(totalCount(player.getSecretParrotfishPolyps())).toBe(1)
    })

    it('rejects a colour the player was not dealt', () => {
        const session = startSession()
        const first = session.currentPlayerId()
        const polyps = session.hydrated().getPlayerState(first).getSecretScreenPolyps()
        const missing = CoralColors.find((color) => polyps[color] === 0)
        assert(missing, 'The test seed deals the start player fewer than five colours')

        expect(() => session.feedParrotfish(first, missing)).toThrow()
    })

    it('accepts only the active player', () => {
        const session = startSession()
        const [, second] = session.state.turnManager.turnOrder

        expect(() => session.feedParrotfish(second, dealtColorOf(session, second))).toThrow()
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
        expect(own?.secretScreenPolyps).toBeDefined()
        expect(own?.secretParrotfishPolyps).toBeDefined()
        expect(other?.secretScreenPolyps).toBeUndefined()
        expect(other?.secretParrotfishPolyps).toBeUndefined()

        for (const player of project(session, spectator).players) {
            expect(player.secretScreenPolyps).toBeUndefined()
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

    it('shows larva cubes openly unless the game is Concealed', () => {
        const open = startSession()
        feedEveryParrotfish(open)
        chooseEveryLarvaCube(open)
        const concealed = startSession({ concealed: true })
        feedEveryParrotfish(concealed)
        chooseEveryLarvaCube(concealed)
        const [first, second] = open.state.turnManager.turnOrder

        const seenOpenly = project(open, asPlayer(first)).players.find((p) => p.playerId === second)
        expect(seenOpenly?.larvaCubes).toMatchObject({ [CoralColor.Pink]: 1, [CoralColor.Grey]: 1 })
        expect(seenOpenly?.shrimpsBehindScreen).toBe(4)

        const seenConcealed = project(concealed, asPlayer(first)).players.find(
            (p) => p.playerId === second
        )
        expect(seenConcealed?.larvaCubes).toBeUndefined()
        expect(seenConcealed?.shrimpsBehindScreen).toBeUndefined()
        expect(
            project(concealed, asPlayer(second)).players.find((p) => p.playerId === second)
                ?.larvaCubes
        ).toBeDefined()
    })
})
