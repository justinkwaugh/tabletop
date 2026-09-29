import {
    type HydratedAction,
    type MachineStateHandler,
    assertExists,
    MachineContext
} from '@tabletop/common'
import { MachineState } from '../definition/states.js'
import { HydratedOathGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { HydratedAnswerQuestion, isAnswerQuestion } from '../actions/answerQuestion.js'
import { HydratedCampaign, isCampaign } from '../actions/campaign.js'
import { currentQuestion, settleQueue } from '../util/questions.js'
import { sneakAttackOfferedTo } from '../util/sneakAttack.js'
import {
    isPlayerActionOfType,
    returnClockToTurnPlayer,
    stateAfterCampaignDeclared
} from './handlerSupport.js'

export class PowerQuestionStateHandler implements MachineStateHandler<
    HydratedAction,
    HydratedOathGameState
> {
    isValidAction(action: HydratedAction, context: MachineContext<HydratedOathGameState>): boolean {
        if (isPlayerActionOfType(action, ActionType.AnswerQuestion)) return true
        // Sneak Attack — "you may campaign": the Campaign is the asked player's yes.
        return (
            isCampaign(action) &&
            sneakAttackOfferedTo(context.gameState, action.playerId) !== undefined
        )
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedOathGameState>
    ): string[] {
        const gameState = context.gameState
        if (!HydratedAnswerQuestion.canAnswer(gameState, playerId)) return []
        const maySneakAttack =
            sneakAttackOfferedTo(gameState, playerId) !== undefined &&
            HydratedCampaign.canDoCampaign(gameState, playerId)
        return maySneakAttack
            ? [ActionType.AnswerQuestion, ActionType.Campaign]
            : [ActionType.AnswerQuestion]
    }

    enter(context: MachineContext<HydratedOathGameState>) {
        const question = currentQuestion(context.gameState)
        if (!question) return
        context.gameState.activePlayerIds = [question.askedPlayerId]
    }

    onAction(action: HydratedAction, context: MachineContext<HydratedOathGameState>): MachineState {
        if (isCampaign(action)) return stateAfterCampaignDeclared(context.gameState)
        if (isAnswerQuestion(action)) {
            const gameState = context.gameState
            const queueIsEmpty = settleQueue(gameState)
            if (!queueIsEmpty) {
                const next = currentQuestion(gameState)
                assertExists(next, 'A non-empty question queue must have a current question')
                gameState.activePlayerIds = [next.askedPlayerId]
                return MachineState.PowerQuestion
            }
            assertExists(action.metadata, 'An answer records where the held turn resumes')
            action.metadata.last = true
            // Read from the action: `pendingQuestions` is cleared below.
            gameState.pendingQuestions = undefined
            returnClockToTurnPlayer(gameState)
            return action.metadata.resumeMachineState
        }
        throw Error(`Unhandled action type: ${action.type}`)
    }
}
