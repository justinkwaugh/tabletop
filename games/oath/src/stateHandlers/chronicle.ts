import {
    type HydratedAction,
    type MachineStateHandler,
    MachineContext,
    type GameAction
} from '@tabletop/common'
import type * as Type from 'typebox'
import { HydratedOathGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import {
    type ChronicleSystemActionType,
    chronicleAfter,
    chronicleWaiting
} from '../util/chronicle.js'
import {
    chronicleOf,
    reasonCannotAnswerChronicleCitizenship,
    reasonCannotBuildOrRepair,
    reasonCannotChooseChronicleSuit,
    reasonCannotChooseHealStack,
    reasonCannotChooseOath,
    reasonCannotOfferChronicleCitizenship,
    reasonCannotWriteChronicleStory
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
import { ChronicleStart, isChronicleStart } from '../actions/chronicleStart.js'
import { ChronicleForcedVow } from '../actions/chronicleForcedVow.js'
import { ChronicleFlipCitizens } from '../actions/chronicleFlipCitizens.js'
import { ChronicleMap } from '../actions/chronicleMap.js'
import { ChronicleSettleSuit } from '../actions/chronicleSettleSuit.js'
import { ChronicleAddCards } from '../actions/chronicleAddCards.js'
import { ChronicleHeal } from '../actions/chronicleHeal.js'
import { ChronicleDispossess } from '../actions/chronicleDispossess.js'
import { ChronicleRelics } from '../actions/chronicleRelics.js'
import { ChronicleRebuild } from '../actions/chronicleRebuild.js'

const CHRONICLE_BEING_WRITTEN = 'The game is over; the chronicle is being written'
const RULES_SETTLE_IT = 'R-8 — the rules settle this step of the chronicle alone'

/** What the rules settle alone at a step, each its own System Action (DESIGN.md). */
const SYSTEM_ACTIONS: Record<ChronicleSystemActionType, Type.TSchema> = {
    [ActionType.ChronicleStart]: ChronicleStart,
    [ActionType.ChronicleForcedVow]: ChronicleForcedVow,
    [ActionType.ChronicleFlipCitizens]: ChronicleFlipCitizens,
    [ActionType.ChronicleMap]: ChronicleMap,
    [ActionType.ChronicleSettleSuit]: ChronicleSettleSuit,
    [ActionType.ChronicleAddCards]: ChronicleAddCards,
    [ActionType.ChronicleHeal]: ChronicleHeal,
    [ActionType.ChronicleDispossess]: ChronicleDispossess,
    [ActionType.ChronicleRelics]: ChronicleRelics,
    [ActionType.ChronicleRebuild]: ChronicleRebuild
}

function isChronicleSystemAction(action: GameAction): boolean {
    return Object.hasOwn(SYSTEM_ACTIONS, action.type)
}

/**
 * R-8 — the won game's chronicle, written before the result: one state whose cursor walks the
 * steps. On entering, it schedules the System Action that settles what the rules decide alone, or
 * waits on the players a choice names. No title, Wake, Rest or turn runs here.
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
        // While a step's System Action settles it, nobody is asked anything.
        if (chronicleWaiting(state).kind !== 'choice') return []
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
        const state = context.gameState
        // The engine enters again after every action; a step's System Action is scheduled once.
        if (context.getPendingActions().length > 0) return
        const wait = chronicleWaiting(state)
        if (wait.kind === 'choice') {
            state.activePlayerIds = wait.choosers
            return
        }
        state.activePlayerIds = []
        if (wait.type === ActionType.ChronicleStart) {
            const { winnerPlayerId, rule } = chronicleOf(state).ending
            context.addSystemAction(ChronicleStart, { winnerPlayerId, rule })
            return
        }
        context.addSystemAction(SYSTEM_ACTIONS[wait.type])
    }

    onAction(action: HydratedAction, context: MachineContext<HydratedOathGameState>): string {
        const state = context.gameState
        if (
            isChronicleSystemAction(action) ||
            isOfferChronicleCitizenship(action) ||
            isAnswerChronicleCitizenship(action) ||
            isChooseOath(action) ||
            isBuildOrRepairEdifice(action) ||
            isChooseChronicleSuit(action) ||
            isChooseHealStack(action) ||
            isWriteChronicleStory(action) ||
            isSkipChronicleStory(action)
        ) {
            return chronicleAfter(state, action)
        }
        throw Error(CHRONICLE_BEING_WRITTEN)
    }

    /**
     * Only the step being written takes an action; every other action is refused. A peek is refused
     * before this handler sees it: `HydratedLetPeek` takes none once the game is won (R-3).
     */
    private reasonCannot(action: HydratedAction, state: HydratedOathGameState): string | undefined {
        if (isChronicleSystemAction(action)) return reasonCannotSettle(action, state)
        if (chronicleWaiting(state).kind !== 'choice') return RULES_SETTLE_IT
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

/** A step's System Action is taken only while that step waits on it, as the rules settled it. */
function reasonCannotSettle(action: GameAction, state: HydratedOathGameState): string | undefined {
    const wait = chronicleWaiting(state)
    if (wait.kind !== 'system' || wait.type !== action.type) {
        return `R-8 — the chronicle does not wait on ${action.type} now`
    }
    if (isChronicleStart(action)) {
        const { winnerPlayerId, rule } = chronicleOf(state).ending
        if (action.winnerPlayerId !== winnerPlayerId || action.rule !== rule) {
            return 'R-8 — the Chronicle begins with the win as it was recorded'
        }
    }
    return undefined
}
