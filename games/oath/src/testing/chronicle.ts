import { assertExists, type Game, type GameAction } from '@tabletop/common'
import { HydratedOathGameState, type OathProjectedState } from '../model/gameState.js'
import { ChronicleStep } from '../model/chronicle.js'
import { MachineState } from '../definition/states.js'
import { ChooseOath } from '../actions/chooseOath.js'
import { OfferChronicleCitizenship } from '../actions/offerChronicleCitizenship.js'
import { BuildOrRepairEdifice } from '../actions/buildOrRepairEdifice.js'
import { ChooseChronicleSuit } from '../actions/chooseChronicleSuit.js'
import { ChooseHealStack } from '../actions/chooseHealStack.js'
import { SkipChronicleStory } from '../actions/skipChronicleStory.js'
import { chronicleSuitLeaders, vowableOaths } from '../util/chronicleChoices.js'
import { recordWin, stateAfterWin } from '../util/chronicle.js'
import type { GameOutcome } from '../util/victory.js'
import { OathStateHandlers } from '../definition/stateHandlers.js'
import { buildAction, machineContext } from './actions.js'
import { engine } from './engine.js'

/**
 * The table as the action that won leaves it: the ending stored, the chronicle written up to the
 * first step that waits, and that step's choosers on the clock.
 */
export function wonTable(state: HydratedOathGameState, outcome: GameOutcome): OathProjectedState {
    recordWin(state, outcome)
    state.machineState = stateAfterWin(state, {})
    OathStateHandlers[state.machineState].enter(machineContext(state))
    return state.dehydrate()
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
