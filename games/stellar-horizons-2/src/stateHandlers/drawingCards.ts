import {
    type HydratedAction,
    type MachineStateHandler,
    MachineContext,
    assertExists
} from '@tabletop/common'
import { DrawCard, HydratedDrawCard, isDrawCard } from '../actions/drawCard.js'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import { drawableLevels, nextCardDrawer } from '../model/cards.js'
import type { HydratedStellarHorizonsGameState } from '../model/gameState.js'
import { type ConversionAction, conversionActions, isConversion } from './conversions.js'
import { resumedAfterCards } from './transitions.js'

type DrawingAction = HydratedDrawCard | ConversionAction

// Cards owed to hands are drawn on the Main Line, one at a time, in initiative order, since
// they come from the shared decks (rulebook 1.20). The drawer chooses each card's level; with
// one level or none left it is drawn for them.
export class DrawingCardsStateHandler implements MachineStateHandler<
    DrawingAction,
    HydratedStellarHorizonsGameState
> {
    isValidAction(
        action: HydratedAction,
        _context: MachineContext<HydratedStellarHorizonsGameState>
    ): action is DrawingAction {
        return isDrawCard(action) || isConversion(action)
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedStellarHorizonsGameState>
    ): ActionType[] {
        const state = context.gameState
        if (!state.isActivePlayer(playerId)) {
            return []
        }
        return [ActionType.DrawCard, ...conversionActions(state, playerId)]
    }

    enter(context: MachineContext<HydratedStellarHorizonsGameState>) {
        const state = context.gameState
        const playerId = nextCardDrawer(state)
        assertExists(playerId, 'Drawing cards needs a draw owed')
        const deck = state.getPlayerState(playerId).cardDraws[0]
        const levels = drawableLevels(state, playerId, deck)
        state.activePlayerIds = [playerId]
        if (levels.length > 1) {
            return
        }
        context.addSystemAction(DrawCard, {
            playerId,
            deck,
            ...(levels.length === 1 ? { level: levels[0] } : {})
        })
    }

    onAction(
        action: DrawingAction,
        context: MachineContext<HydratedStellarHorizonsGameState>
    ): MachineState {
        const state = context.gameState
        if (isConversion(action) || nextCardDrawer(state) !== undefined) {
            return MachineState.DrawingCards
        }
        const resume = state.resumeAfterCards
        assertExists(resume, 'Drawing cards needs a step to resume')
        state.resumeAfterCards = undefined
        return resumedAfterCards(state, resume)
    }
}
