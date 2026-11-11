import { MachineContext, assert, assertExists, type Game, type GameAction } from '@tabletop/common'
import { HydratedOathGameState, type OathProjectedState } from '../model/gameState.js'
import { ChronicleStep } from '../model/chronicle.js'
import { MachineState, toMachineState } from '../definition/states.js'
import { ChooseOath } from '../actions/chooseOath.js'
import { OfferChronicleCitizenship } from '../actions/offerChronicleCitizenship.js'
import { AnswerChronicleCitizenship } from '../actions/answerChronicleCitizenship.js'
import { BuildOrRepairEdifice } from '../actions/buildOrRepairEdifice.js'
import { ChooseChronicleSuit } from '../actions/chooseChronicleSuit.js'
import { ChooseHealStack } from '../actions/chooseHealStack.js'
import { SkipChronicleStory } from '../actions/skipChronicleStory.js'
import {
    CHRONICLE_CITIZENSHIP_GROUP,
    chronicleSuitLeaders,
    vowableOaths
} from '../util/chronicleChoices.js'
import { recordWin, stateAfterWin } from '../util/chronicle.js'
import type { GameOutcome } from '../util/victory.js'
import { OathStateHandlers } from '../definition/stateHandlers.js'
import { OathHydrator } from '../definition/hydrator.js'
import { buildAction } from './actions.js'
import { engine } from './engine.js'

/**
 * The table as the action that won leaves it: the ending stored, the chronicle's System Actions
 * run up to the first step that waits, and that step's choosers on the clock.
 */
export function wonTable(state: HydratedOathGameState, outcome: GameOutcome): OathProjectedState {
    return wonWithActions(state, outcome).final
}

/** `wonTable`, with the System Actions the win scheduled, as the engine records them. */
export function wonWithActions(
    state: HydratedOathGameState,
    outcome: GameOutcome
): { final: OathProjectedState; actions: GameAction[] } {
    recordWin(state, outcome)
    // As the engine's, the System Actions' ids follow from the action that won (system version 1).
    const context = new MachineContext<HydratedOathGameState>({
        action: buildAction(SkipChronicleStory, { id: 'won', playerId: outcome.winnerPlayerId }),
        gameConfig: {},
        gameState: state
    })
    context.nextPendingAction()
    state.machineState = stateAfterWin(state)
    OathStateHandlers[state.machineState].enter(context)
    const actions = runSystemActions(state, context)
    return { final: state.dehydrate(), actions }
}

/** The engine's loop for the System Actions `context` holds, as a processed action schedules them. */
export function runSystemActions(
    state: HydratedOathGameState,
    context: MachineContext<HydratedOathGameState>
): GameAction[] {
    const hydrator = new OathHydrator()
    const processed: GameAction[] = []
    for (let next = context.nextPendingAction(); next; next = context.nextPendingAction()) {
        const action = hydrator.hydrateAction(structuredClone(next))
        const handler = OathStateHandlers[state.machineState]
        assert(handler.isValidAction(action, context), `${action.type} is valid now`)
        action.apply(state, context)
        state.machineState = toMachineState(handler.onAction(action, context))
        state.recordAction(action)
        OathStateHandlers[state.machineState].enter(context)
        processed.push(action.dehydrate())
    }
    return processed
}

/** An offered Exile's answer, in the group every answer belongs to (R-8.2-H1). */
export function chronicleAnswer(playerId: string, accept: boolean, id = `answer-${playerId}`) {
    return buildAction(AnswerChronicleCitizenship, {
        id,
        playerId,
        accept,
        simultaneousGroupId: CHRONICLE_CITIZENSHIP_GROUP
    })
}

/**
 * The plainest answer to the step being written: the first Oath on offer, no offer of Citizenship,
 * no edifice, the first tied suit or stack, no story.
 */
export function plainestChronicleAnswer(state: OathProjectedState): GameAction {
    const hydrated = new HydratedOathGameState(state)
    const chronicle = hydrated.chronicle
    assertExists(chronicle, 'R-8 — the chronicle is being written')
    const playerId = chronicle.ending.winnerPlayerId
    switch (chronicle.step) {
        case ChronicleStep.Vow:
            return buildAction(ChooseOath, { playerId, oathType: vowableOaths(hydrated)[0] })
        case ChronicleStep.Citizenship:
            return buildAction(OfferChronicleCitizenship, { playerId, exilePlayerIds: [] })
        case ChronicleStep.BuildOrRepair:
            return buildAction(BuildOrRepairEdifice, { playerId })
        case ChronicleStep.Suit:
            return buildAction(ChooseChronicleSuit, {
                playerId,
                suit: chronicleSuitLeaders(hydrated)[0]
            })
        case ChronicleStep.HealStack: {
            const [suit] = chronicle.healTie?.suits ?? []
            assertExists(suit, 'R-8.4.a-H1 — the tie is published')
            return buildAction(ChooseHealStack, { playerId, suit })
        }
        case ChronicleStep.Story:
            return buildAction(SkipChronicleStory, { playerId })
        default:
            throw Error(`R-8 — ${chronicle.step} waits on no one`)
    }
}

/** Answers every step still waiting with its plainest answer, up to the result. */
export function writeChronicleThrough(
    game: Game,
    state: OathProjectedState
): { final: OathProjectedState; actions: GameAction[] } {
    let final = state
    const actions: GameAction[] = []
    while (final.machineState === MachineState.Chronicle) {
        const result = engine.runNext(plainestChronicleAnswer(final), final, game)
        actions.push(...result.processedActions)
        final = result.updatedState
    }
    return { final, actions }
}
