import {
    type HydratedAction,
    type MachineContext,
    type MachineStateHandler
} from '@tabletop/common'
import { MachineState, toMachineState } from './states.js'
import { SetupStateHandler } from '../stateHandlers/setup.js'
import { WakePhaseStateHandler } from '../stateHandlers/wakePhase.js'
import { ActPhaseStateHandler } from '../stateHandlers/actPhase.js'
import { RestPhaseStateHandler } from '../stateHandlers/restPhase.js'
import { SearchingStateHandler } from '../stateHandlers/searching.js'
import {
    CampaignDefeatStateHandler,
    CampaignPlansStateHandler,
    CampaignSacrificeStateHandler,
    CampaignVictoryStateHandler
} from '../stateHandlers/campaigning.js'
import { OathkeeperChoiceStateHandler } from '../stateHandlers/oathkeeperChoice.js'
import { ConsentRequestStateHandler } from '../stateHandlers/consentRequest.js'
import { PowerQuestionStateHandler } from '../stateHandlers/powerQuestion.js'
import { EndOfGameStateHandler } from '../stateHandlers/endOfGame.js'
import type { HydratedOathGameState } from '../model/gameState.js'
import { applyForcedTitleChanges } from '../util/title.js'
import { settleQueue } from '../util/questionAnswers.js'
import { carryFreeActions } from '../util/freeActions.js'
import { teachReliquaryToScepterHolder } from '../util/hiddenInputs.js'
import { HydratedLetPeek, isLetPeek } from '../actions/letPeek.js'
import { TransferOathkeeper, isTransferOathkeeper } from '../actions/transferOathkeeper.js'
import { OathRevision, isAtLeastOathRevision } from '../util/revision.js'
import { ActionType } from './actions.js'

type OathStateHandler = MachineStateHandler<HydratedAction, HydratedOathGameState>

/** The engine offers no per-action hook, so each automatic consequence wraps `onAction`. */
function wrapOnAction(
    handler: OathStateHandler,
    onAction: OathStateHandler['onAction']
): OathStateHandler {
    return {
        isValidAction: (action, context) => handler.isValidAction(action, context),
        validActionsForPlayer: (playerId, context) =>
            handler.validActionsForPlayer(playerId, context),
        enter: (context) => handler.enter(context),
        onAction
    }
}

/** R-2.11-H1 — the Oathkeeper title is re-evaluated after every action. */
function withContinuousTitle(handler: OathStateHandler): OathStateHandler {
    return {
        isValidAction: (action, context) =>
            isTransferOathkeeper(action) || handler.isValidAction(action, context),
        validActionsForPlayer: (playerId, context) =>
            handler.validActionsForPlayer(playerId, context),
        enter: (context) => handler.enter(context),
        onAction: (action, context) => {
            const gameState = context.gameState
            const next = isTransferOathkeeper(action)
                ? toMachineState(gameState.machineState)
                : handler.onAction(action, context)
            if (gameState.winningPlayerIds.length > 0) return next

            settleTitle(context, toMachineState(next))

            // R-2.11.b leaves the outgoing holder a choice, so the machine detours.
            return gameState.pendingOathkeeperChoice ? MachineState.OathkeeperChoice : next
        }
    }
}

/** A recorded move is applied by its own System Action, so the History can read it. */
function settleTitle(context: MachineContext<HydratedOathGameState>, resume: MachineState) {
    const gameState = context.gameState
    if (!isAtLeastOathRevision(gameState, OathRevision.TurnFlow)) {
        applyForcedTitleChanges(gameState, resume)
        return
    }
    if (context.getPendingActions().some(isTransferOathkeeper)) return
    applyForcedTitleChanges(gameState, resume, (move) =>
        context.addSystemAction(TransferOathkeeper, move)
    )
}

/** The inner handler's destination is where the held turn resumes. */
function withPowerQuestions(handler: OathStateHandler): OathStateHandler {
    return wrapOnAction(handler, (action, context) => {
        const next = handler.onAction(action, context)
        const gameState = context.gameState
        if (!gameState.pendingQuestions || next === MachineState.PowerQuestion) return next
        if (settleQueue(gameState)) {
            gameState.pendingQuestions = undefined
            return next
        }
        gameState.pendingQuestions.resumeMachineState = toMachineState(next)
        return MachineState.PowerQuestion
    })
}

function withFreeActionsCarried(handler: OathStateHandler): OathStateHandler {
    return wrapOnAction(handler, (action, context) => {
        const gameState = context.gameState
        carryFreeActions(gameState, action, toMachineState(gameState.machineState))
        return handler.onAction(action, context)
    })
}

/** R-6.4-H1 — a Grand Scepter changing hands teaches its new holder the Reliquary (R-X.3). */
function withReliquaryKnownToScepterHolder(handler: OathStateHandler): OathStateHandler {
    return wrapOnAction(handler, (action, context) => {
        const next = handler.onAction(action, context)
        if (teachReliquaryToScepterHolder(context.gameState)) action.revealsInfo = true
        return next
    })
}

/** R-9.4, R-6.6.1 — letting another peek is allowed in every state and moves no state. */
function withLetPeekAnyTime(handler: OathStateHandler): OathStateHandler {
    return {
        isValidAction: (action, context) =>
            isLetPeek(action)
                ? HydratedLetPeek.canDoLetPeek(context.gameState, action.playerId)
                : handler.isValidAction(action, context),
        validActionsForPlayer: (playerId, context) => {
            const types = handler.validActionsForPlayer(playerId, context)
            return HydratedLetPeek.canDoLetPeek(context.gameState, playerId)
                ? [...types, ActionType.LetPeek]
                : types
        },
        enter: (context) => handler.enter(context),
        onAction: (action, context) =>
            isLetPeek(action)
                ? toMachineState(context.gameState.machineState)
                : handler.onAction(action, context)
    }
}

function everyStateCarryingFreeActions(
    handlers: Record<MachineState, OathStateHandler>
): Record<MachineState, OathStateHandler> {
    const carrying = { ...handlers }
    for (const state of Object.values(MachineState)) {
        carrying[state] = withFreeActionsCarried(
            withLetPeekAnyTime(withReliquaryKnownToScepterHolder(handlers[state]))
        )
    }
    return carrying
}

export const OathStateHandlers = everyStateCarryingFreeActions({
    // R-1.14 fixes the title on the Chancellor, so there is nothing to re-evaluate.
    [MachineState.Setup]: new SetupStateHandler(),
    [MachineState.WakePhase]: withContinuousTitle(new WakePhaseStateHandler()),
    [MachineState.ActPhase]: withContinuousTitle(withPowerQuestions(new ActPhaseStateHandler())),
    [MachineState.RestPhase]: withContinuousTitle(new RestPhaseStateHandler()),
    [MachineState.Searching]: withContinuousTitle(withPowerQuestions(new SearchingStateHandler())),
    [MachineState.CampaignPlans]: withContinuousTitle(
        withPowerQuestions(new CampaignPlansStateHandler())
    ),
    [MachineState.CampaignSacrifice]: withContinuousTitle(
        withPowerQuestions(new CampaignSacrificeStateHandler())
    ),
    [MachineState.CampaignDefeat]: withContinuousTitle(
        withPowerQuestions(new CampaignDefeatStateHandler())
    ),
    [MachineState.CampaignVictory]: withContinuousTitle(
        withPowerQuestions(new CampaignVictoryStateHandler())
    ),
    // Not wrapped: re-evaluating the title mid-settlement would reopen the choice being made.
    [MachineState.OathkeeperChoice]: new OathkeeperChoiceStateHandler(),
    // Wrapped: R-6.6.2 changes who rules what, and its Vision discard can prompt False Prophet.
    [MachineState.ConsentRequest]: withContinuousTitle(
        withPowerQuestions(new ConsentRequestStateHandler())
    ),
    // Wrapped: a Sneak Attack's Campaign is declared from here, and its roll can ask (Jinx).
    [MachineState.PowerQuestion]: withContinuousTitle(
        withPowerQuestions(new PowerQuestionStateHandler())
    ),
    [MachineState.EndOfGame]: new EndOfGameStateHandler()
})
