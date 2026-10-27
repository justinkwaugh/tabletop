import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { HydratedOathGameState } from '../model/gameState.js'
import { MachineState } from '../definition/states.js'
import { ActionType } from '../definition/actions.js'
import { chroniclersOf, completeChronicleStep } from '../util/chronicle.js'
import {
    reasonCannotAnswerChronicleCitizenship,
    reasonCannotBuildOrRepair,
    reasonCannotChooseChronicleSuit,
    reasonCannotChooseHealStack,
    reasonCannotChooseOath,
    reasonCannotOfferChronicleCitizenship,
    reasonCannotWriteChronicleStory,
    unansweredOffers
} from '../util/chronicleChoices.js'
import { HydratedChooseOath, isChooseOath } from '../actions/chooseOath.js'
import {
    HydratedOfferChronicleCitizenship,
    isOfferChronicleCitizenship
} from '../actions/offerChronicleCitizenship.js'
import {
    HydratedAnswerChronicleCitizenship,
    isAnswerChronicleCitizenship
} from '../actions/answerChronicleCitizenship.js'
import {
    HydratedBuildOrRepairEdifice,
    isBuildOrRepairEdifice
} from '../actions/buildOrRepairEdifice.js'
import {
    HydratedChooseChronicleSuit,
    isChooseChronicleSuit
} from '../actions/chooseChronicleSuit.js'
import { HydratedChooseHealStack, isChooseHealStack } from '../actions/chooseHealStack.js'
import {
    HydratedWriteChronicleStory,
    isWriteChronicleStory
} from '../actions/writeChronicleStory.js'
import { isSkipChronicleStory } from '../actions/skipChronicleStory.js'

const CHRONICLE_BEING_WRITTEN = 'The game is over; the chronicle is being written'

/**
 * R-8 — the won game's chronicle, written before the result: one state whose cursor walks the
 * steps. No title, Wake, Rest or turn runs here; only the players a step waits on act.
 */
export class ChronicleStateHandler implements MachineStateHandler<
    HydratedAction,
    HydratedOathGameState
> {
    /** The engine's validity check is this method's only caller, so a refusal reaches the player as written. */
    isValidAction(action: HydratedAction, context: MachineContext<HydratedOathGameState>): boolean {
        const reason = this.reasonCannot(action, context.gameState)
        if (reason) throw Error(reason)
        return true
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedOathGameState>
    ): string[] {
        const state = context.gameState
        const types: string[] = []
        if (HydratedChooseOath.canDoChooseOath(state, playerId)) types.push(ActionType.ChooseOath)
        if (HydratedOfferChronicleCitizenship.canDoOfferChronicleCitizenship(state, playerId)) {
            types.push(ActionType.OfferChronicleCitizenship)
        }
        if (HydratedAnswerChronicleCitizenship.canDoAnswerChronicleCitizenship(state, playerId)) {
            types.push(ActionType.AnswerChronicleCitizenship)
        }
        if (HydratedBuildOrRepairEdifice.canDoBuildOrRepairEdifice(state, playerId)) {
            types.push(ActionType.BuildOrRepairEdifice)
        }
        if (HydratedChooseChronicleSuit.canDoChooseChronicleSuit(state, playerId)) {
            types.push(ActionType.ChooseChronicleSuit)
        }
        if (HydratedChooseHealStack.canDoChooseHealStack(state, playerId)) {
            types.push(ActionType.ChooseHealStack)
        }
        if (HydratedWriteChronicleStory.canDoWriteChronicleStory(state, playerId)) {
            types.push(ActionType.WriteChronicleStory, ActionType.SkipChronicleStory)
        }
        return types
    }

    enter(context: MachineContext<HydratedOathGameState>): void {
        context.gameState.activePlayerIds = chroniclersOf(context.gameState)
    }

    onAction(action: HydratedAction, context: MachineContext<HydratedOathGameState>): string {
        const state = context.gameState
        // R-8.2-H1 — the offers wait on every offered Exile's answer, given in any order.
        if (isOfferChronicleCitizenship(action)) {
            return action.exilePlayerIds.length > 0
                ? MachineState.Chronicle
                : completeChronicleStep(state)
        }
        if (isAnswerChronicleCitizenship(action)) {
            return unansweredOffers(state).length > 0
                ? MachineState.Chronicle
                : completeChronicleStep(state)
        }
        if (
            isChooseOath(action) ||
            isBuildOrRepairEdifice(action) ||
            isChooseChronicleSuit(action) ||
            isChooseHealStack(action) ||
            isWriteChronicleStory(action) ||
            isSkipChronicleStory(action)
        ) {
            return completeChronicleStep(state)
        }
        throw Error(CHRONICLE_BEING_WRITTEN)
    }

    /** Only the step being written takes an action; every other action is refused. */
    private reasonCannot(action: HydratedAction, state: HydratedOathGameState): string | undefined {
        const playerId = action.playerId ?? ''
        if (isChooseOath(action)) return reasonCannotChooseOath(state, playerId, action.oathType)
        if (isOfferChronicleCitizenship(action)) {
            return reasonCannotOfferChronicleCitizenship(state, playerId, action.exilePlayerIds)
        }
        if (isAnswerChronicleCitizenship(action)) {
            return reasonCannotAnswerChronicleCitizenship(state, playerId)
        }
        if (isBuildOrRepairEdifice(action)) {
            return reasonCannotBuildOrRepair(state, playerId, action.choice)
        }
        if (isChooseChronicleSuit(action)) {
            return reasonCannotChooseChronicleSuit(state, playerId, action.suit)
        }
        if (isChooseHealStack(action)) {
            return reasonCannotChooseHealStack(state, playerId, action.suit)
        }
        if (isWriteChronicleStory(action)) {
            return reasonCannotWriteChronicleStory(state, playerId, action.text)
        }
        if (isSkipChronicleStory(action)) return reasonCannotWriteChronicleStory(state, playerId)
        return CHRONICLE_BEING_WRITTEN
    }
}
