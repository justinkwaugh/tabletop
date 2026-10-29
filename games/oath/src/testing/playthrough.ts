import type { Game, GameAction, GameConfig } from '@tabletop/common'
import { CompleteRest } from '../actions/completeRest.js'
import { EndActPhase } from '../actions/endActPhase.js'
import { ResolveWake, type WakeFavorStep } from '../actions/resolveWake.js'
import { RollEndDie } from '../actions/rollEndDie.js'
import { SetupChoice } from '../actions/setupChoice.js'
import { TOP_CRADLE_SLOT } from '../data/mapSlots.js'
import { MachineState } from '../definition/states.js'
import { HydratedOathGameState, type OathProjectedState } from '../model/gameState.js'
import { Banner } from '../model/oathEnums.js'
import {
    applyPeoplesFavorStep,
    availablePeoplesFavorOptions,
    banksWithLeastFavor,
    peoplesFavorStepCount
} from '../util/wake.js'
import { buildAction } from './actions.js'
import { engine } from './engine.js'
import { waitingGame } from './game.js'

export const MASTER_SEED = '0123456789abcdef0123456789abcdef'

export function start(game: Game, order?: string[]): OathProjectedState {
    return engine.startGame(game, {
        masterSeed: MASTER_SEED,
        ...(order ? { startingPositions: { playerIds: order } } : {})
    }).initialState
}

/** R-1.23 — the seat keeps its first adviser and places its pawn; the Chancellor at the top of the Cradle. */
function setupChoice(state: OathProjectedState, playerId: string): GameAction {
    const hydrated = new HydratedOathGameState(state)
    const hand = hydrated.getPlayerState(playerId).knownHand()
    return buildAction(SetupChoice, {
        playerId,
        siteId:
            playerId === state.chancellorPlayerId ? TOP_CRADLE_SLOT : hydrated.faceupSiteIds()[1],
        adviserCardId: hand[0],
        discardOrder: hand.slice(1)
    })
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

/** R-4.1 to R-4.3 — a Wake, a turn of no actions, and a Rest; R-4.3.5 — the Rest waits on the seat only while it holds a Rest power it can use. R-3.3 — the Chancellor's end die between rounds. */
function passiveAction(state: OathProjectedState): GameAction {
    const [playerId] = state.activePlayerIds
    switch (state.machineState) {
        case MachineState.Setup:
            return setupChoice(state, playerId)
        case MachineState.WakePhase:
            return buildAction(ResolveWake, {
                playerId,
                favorSteps: peoplesFavorSteps(state, playerId)
            })
        case MachineState.RestPhase:
            return buildAction(CompleteRest, { playerId })
        case MachineState.EndOfRound:
            return buildAction(RollEndDie, { playerId })
        default:
            return buildAction(EndActPhase, { playerId })
    }
}

export function playPassiveMove(game: Game, state: OathProjectedState): OathProjectedState {
    return engine.runNext(passiveAction(state), state, game).updatedState
}

/** R-1.23 — each seat keeps an adviser and places its pawn, in turn order. */
export function playSetup(game: Game, initial: OathProjectedState) {
    let state = initial
    const actors: string[] = []
    while (state.machineState === MachineState.Setup) {
        actors.push(state.activePlayerIds[0])
        state = playPassiveMove(game, state)
    }
    return { state, actors }
}

export function playUntilTheEnd(game: Game, initial: OathProjectedState): OathProjectedState {
    let state = initial
    while (state.machineState !== MachineState.EndOfGame) state = playPassiveMove(game, state)
    return state
}

/** Setup under a reversed assignment; `seed` fixes R-3.3's end die, which is the only protected draw after setup. */
export function assignedGame(count: number, config: GameConfig, seed?: number) {
    const game = waitingGame(count, config)
    const order = game.players.map((player) => player.id).reverse()
    const initial = start(game, order)
    if (seed !== undefined) initial.protectedPrng = { seed, invocations: 0 }
    return { game, order, state: playSetup(game, initial).state }
}

/** R-3.3 ends a passive game in rounds five to seven, R-3.4 at the end of the eighth; the first seed ending in `rounds`. */
export function finishedWithin(count: number, rounds: (round: number) => boolean) {
    for (let seed = 1; seed < 100; seed++) {
        const { game, order, state } = assignedGame(count, {}, seed)
        const finished = playUntilTheEnd(game, state)
        if (rounds(finished.round)) return { game, order, finished }
    }
    throw Error('no seed below 100 ends in the rounds asked for')
}
