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
import { HydratedTravel, isTravel } from '../actions/travel.js'
import { currentQuestion } from '../util/questions.js'
import { settleQueue } from '../util/questionAnswers.js'
import { freeActionOutOfTurnOfferedTo, sneakAttackOfferedTo } from '../util/sneakAttack.js'
import {
    isPlayerActionOfType,
    returnClockToTurnPlayer,
    stateAfterCampaignDeclared,
    stateAfterCampaignRoll,
    stateAfterTravelOutOfTurn
} from './handlerSupport.js'

export class PowerQuestionStateHandler implements MachineStateHandler<
    HydratedAction,
    HydratedOathGameState
> {
    isValidAction(action: HydratedAction, context: MachineContext<HydratedOathGameState>): boolean {
        if (isPlayerActionOfType(action, ActionType.AnswerQuestion)) return true
        const state = context.gameState
        // Sneak Attack — "you may campaign": the Campaign is the asked player's yes.
        // Second Wind out of turn — "you may travel and then may campaign": so is each action.
        if (isCampaign(action)) {
            return (
                sneakAttackOfferedTo(state, action.playerId) !== undefined ||
                freeActionOutOfTurnOfferedTo(state, action.playerId, ActionType.Campaign) !==
                    undefined
            )
        }
        return (
            isTravel(action) &&
            freeActionOutOfTurnOfferedTo(state, action.playerId, ActionType.Travel) !== undefined
        )
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedOathGameState>
    ): string[] {
        const gameState = context.gameState
        if (!HydratedAnswerQuestion.canAnswer(gameState, playerId)) return []
        const mayCampaign =
            (sneakAttackOfferedTo(gameState, playerId) !== undefined ||
                freeActionOutOfTurnOfferedTo(gameState, playerId, ActionType.Campaign) !==
                    undefined) &&
            HydratedCampaign.canDoCampaign(gameState, playerId)
        if (mayCampaign) return [ActionType.AnswerQuestion, ActionType.Campaign]
        const mayTravel =
            freeActionOutOfTurnOfferedTo(gameState, playerId, ActionType.Travel) !== undefined &&
            HydratedTravel.canDoTravel(gameState, playerId)
        return mayTravel
            ? [ActionType.AnswerQuestion, ActionType.Travel]
            : [ActionType.AnswerQuestion]
    }

    enter(context: MachineContext<HydratedOathGameState>) {
        const question = currentQuestion(context.gameState)
        if (!question) return
        context.gameState.activePlayerIds = [question.askedPlayerId]
    }

    onAction(action: HydratedAction, context: MachineContext<HydratedOathGameState>): MachineState {
        if (isCampaign(action)) return stateAfterCampaignDeclared(context.gameState)
        if (isTravel(action)) return stateAfterTravelOutOfTurn(context.gameState, action.metadata)
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
            // Jinx — the skulls' kills settled with the last answer may wait for the attacker's pick.
            if (action.metadata.resumeMachineState === MachineState.CampaignSacrifice) {
                action.metadata.resumeMachineState = stateAfterCampaignRoll(gameState)
            }
            return action.metadata.resumeMachineState
        }
        throw Error(`Unhandled action type: ${action.type}`)
    }
}
