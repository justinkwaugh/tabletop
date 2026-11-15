import {
    GameEngine,
    GameStorage,
    PlayerStatus,
    assert,
    assertExists,
    createGameFork,
    linkGameContinuation,
    type Game,
    type GameAction,
    type Player
} from '@tabletop/common'
import { Definition } from '../definition/runtime.js'
import { MachineState } from '../definition/states.js'
import { HydratedOathGameState, type OathProjectedState } from '../model/gameState.js'
import { Banner } from '../model/oathEnums.js'
import { ChronicleStep } from '../model/chronicle.js'
import { TOP_CRADLE_SLOT } from '../data/mapSlots.js'
import { SetupChoice } from '../actions/setupChoice.js'
import { ResolveWake, type WakeFavorStep } from '../actions/resolveWake.js'
import { EndActPhase } from '../actions/endActPhase.js'
import { CompleteRest } from '../actions/completeRest.js'
import { RollEndDie } from '../actions/rollEndDie.js'
import { WriteChronicleStory } from '../actions/writeChronicleStory.js'
import {
    applyPeoplesFavorStep,
    availablePeoplesFavorOptions,
    banksWithLeastFavor,
    peoplesFavorStepCount
} from '../util/wake.js'
import { buildAction } from './actions.js'
import { plainestChronicleAnswer } from './chronicle.js'
import { served } from './projection.js'

// A local game as the site plays one: created, run on the full state in the browser, and kept in
// the browser's store as structured clones.

/** What the store keeps for one game. */
export interface LocalGameData {
    game: Game
    state: OathProjectedState
    actions: GameAction[]
}

export type LocalGameStore = Map<string, LocalGameData>

/** A game as far as it has been played. */
export interface LocalPlay {
    game: Game
    state: OathProjectedState
    actions: GameAction[]
}

const platform = new GameEngine(Definition.runtime)

function cloned(data: LocalGameData): LocalGameData {
    return {
        game: structuredClone(data.game),
        state: structuredClone(data.state),
        actions: data.actions.map((action) => structuredClone(action))
    }
}

export async function createLocalGame(
    game: Partial<Game>,
    options: { masterSeed: string; continueFromGameId?: string },
    store: LocalGameStore
): Promise<LocalPlay> {
    for (const player of game.players ?? []) player.userId = game.ownerId
    const initialized = Definition.runtime.initializer.initializeGame(game, Definition as never)
    const continuation = await linkGameContinuation(
        initialized,
        options.continueFromGameId,
        Definition as never,
        async (sourceGameId) => {
            const stored = store.get(sourceGameId)
            if (stored === undefined) return undefined
            const { game: source, state } = cloned(stored)
            return { ...source, state }
        }
    )
    const { startedGame, initialState } = platform.startGame(initialized, {
        masterSeed: options.masterSeed,
        continuation: continuation as never
    })
    startedGame.activePlayerIds = initialState.activePlayerIds
    store.set(startedGame.id, cloned({ game: startedGame, state: initialState, actions: [] }))
    return { game: startedGame, state: initialState, actions: [] }
}

export function saveLocally(store: LocalGameStore, { game, state, actions }: LocalPlay): void {
    const data = cloned({ game, state, actions })
    data.game.activePlayerIds = data.state.activePlayerIds
    data.game.canContinue = data.state.canContinue
    assert(game.storage === GameStorage.Local, 'Can only save local games locally')
    platform.validateCanonicalState(data.state)
    store.set(data.game.id, data)
}

export function loadLocally(store: LocalGameStore, id: string): LocalPlay {
    const stored = store.get(id)
    assertExists(stored, `No local game ${id}`)
    const data = cloned(stored)
    platform.validateCanonicalState(data.state)
    return data
}

export function forkLocally(
    store: LocalGameStore,
    id: string,
    actionIndex: number,
    name?: string
): LocalPlay {
    const { game, state, actions } = loadLocally(store, id)
    const fork = createGameFork({
        game,
        state,
        actions,
        actionIndex,
        runtime: Definition.runtime,
        name
    })
    saveLocally(store, fork)
    return fork
}

/**
 * The seats Continue offers for a hotseat game: every seat a new id with the same name and no
 * account; the seat with the owner's name is the owner's.
 */
export function continuedPlayers(
    source: Game,
    owner: { userId: string; name: string },
    newId: (name: string) => string
): Player[] {
    return source.players.map((player) => ({
        id: newId(player.name),
        isHuman: player.isHuman,
        ...(player.name === owner.name ? { userId: owner.userId } : {}),
        name: player.name,
        status: PlayerStatus.Joined
    }))
}

function stamped(play: LocalPlay, fields: GameAction): GameAction {
    return { ...fields, gameId: play.state.gameId, id: `a-${play.state.actionCount}` }
}

/** Whether the acting seat's own client, holding only its view, would send `fields`. */
export function acceptedOnOwnView(play: LocalPlay, fields: GameAction): boolean {
    const action = stamped(play, fields)
    const perspective = { kind: 'player' as const, playerId: action.playerId ?? '' }
    return platform.accepts({
        action,
        state: served(play.state, perspective),
        game: play.game,
        perspective
    })
}

/** One action by the seat on the clock, accepted first on that seat's own view. */
export function playStep(play: LocalPlay, fields: GameAction): LocalPlay {
    const { game, state } = play
    const action = stamped(play, fields)
    assert(
        acceptedOnOwnView(play, fields),
        `${action.type} by ${action.playerId} is not accepted on their own view`
    )
    const result = platform.executeCanonicalAction({ action, state, game })
    return {
        game,
        state: result.updatedState,
        actions: [...play.actions, ...result.processedActions]
    }
}

/** R-4.1.1 — the holder places favor while they have it, and otherwise returns it to a bank with the least. */
function peoplesFavorSteps(state: OathProjectedState, playerId: string): WakeFavorStep[] {
    if (state.banners[Banner.PeoplesFavor].holderPlayerId !== playerId) return []
    const rehearsal = new HydratedOathGameState(structuredClone(state))
    const steps: WakeFavorStep[] = []
    while (steps.length < peoplesFavorStepCount(rehearsal)) {
        const [kind] = availablePeoplesFavorOptions(rehearsal, playerId)
        if (kind === undefined) break
        const step: WakeFavorStep =
            kind === 'place' ? { kind } : { kind, toSuit: banksWithLeastFavor(rehearsal)[0] }
        applyPeoplesFavorStep(rehearsal, playerId, step)
        steps.push(step)
    }
    return steps
}

/**
 * The shortest legal step of the seat on the clock: the first setup choice offered; a Wake, an Act
 * Phase with no action (R-4.2) and a Rest (R-4.3); the end die (R-3.3); a chronicle step's
 * plainest answer, or `story` written.
 */
export function shortestStep(state: OathProjectedState, story?: string): GameAction {
    const [playerId] = state.activePlayerIds
    assertExists(playerId, `Nobody is on the clock in ${state.machineState}`)
    switch (state.machineState) {
        case MachineState.Setup: {
            const hydrated = new HydratedOathGameState(structuredClone(state))
            const hand = hydrated.getPlayerState(playerId).knownHand()
            return buildAction(SetupChoice, {
                playerId,
                siteId:
                    playerId === state.chancellorPlayerId
                        ? TOP_CRADLE_SLOT
                        : hydrated.faceupSiteIds()[1],
                adviserCardId: hand[0],
                discardOrder: hand.slice(1)
            })
        }
        case MachineState.WakePhase:
            return buildAction(ResolveWake, {
                playerId,
                favorSteps: peoplesFavorSteps(state, playerId)
            })
        case MachineState.ActPhase:
            return buildAction(EndActPhase, { playerId })
        case MachineState.RestPhase:
            return buildAction(CompleteRest, { playerId })
        case MachineState.EndOfRound:
            return buildAction(RollEndDie, { playerId })
        case MachineState.Chronicle:
            return state.chronicle?.step === ChronicleStep.Story && story !== undefined
                ? buildAction(WriteChronicleStory, { playerId, text: story })
                : plainestChronicleAnswer(state)
        default:
            throw Error(`${playerId} is offered nothing the driver takes in ${state.machineState}`)
    }
}

/** Shortest steps until `done`, each saved through `onStep`. */
export function playUntil(
    play: LocalPlay,
    done: (state: OathProjectedState) => boolean,
    onStep: (play: LocalPlay) => void = () => {},
    story?: string
): LocalPlay {
    let next = play
    while (!done(next.state)) {
        next = playStep(next, shortestStep(next.state, story))
        onStep(next)
    }
    return next
}

/** R-3.3, R-3.4.1 — with nobody acting, the game is won by the end of round 8. */
export function playToWin(play: LocalPlay, onStep?: (play: LocalPlay) => void): LocalPlay {
    const won = playUntil(
        play,
        (state) =>
            state.machineState === MachineState.Chronicle ||
            state.machineState === MachineState.EndOfGame,
        (step) => {
            assert(step.state.round <= 8, 'R-3.4.1 — the game ends by the end of round 8')
            onStep?.(step)
        }
    )
    assert(won.state.winningPlayerIds.length > 0, 'The game was won')
    return won
}

/** R-8 — every step of the chronicle that waits, answered plainly, and the story written. */
export function writeChronicle(
    play: LocalPlay,
    story: string,
    onStep?: (play: LocalPlay) => void
): LocalPlay {
    return playUntil(play, (state) => state.machineState !== MachineState.Chronicle, onStep, story)
}
