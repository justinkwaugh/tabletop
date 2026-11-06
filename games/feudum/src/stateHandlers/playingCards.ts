import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { cardPlayOffers } from '../actions/cardPlay.js'
import { HydratedForfeitCard, isForfeitCard } from '../actions/forfeitCard.js'
import { HydratedImprove, isImprove } from '../actions/improve.js'
import { HydratedInfluence, isInfluence } from '../actions/influence.js'
import { HydratedMigrate, isMigrate } from '../actions/migrate.js'
import { HydratedMove, isMove } from '../actions/move.js'
import { HydratedPlayDefend, isPlayDefend } from '../actions/playDefend.js'
import { HydratedTax, isTax } from '../actions/tax.js'
import { HydratedTendLandscape, isTendLandscape } from '../actions/tendLandscape.js'
import type { ActionCardKind } from '../data/cards.js'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import type { HydratedFeudumGameState } from '../model/gameState.js'
import { askCardTurn, stateAfterCardStep } from './cardTurns.js'

/** A card play's hydrated Action. A new card adds its class here. */
type HydratedCardPlay =
    | HydratedForfeitCard
    | HydratedPlayDefend
    | HydratedMove
    | HydratedMigrate
    | HydratedInfluence
    | HydratedTax
    | HydratedImprove
    | HydratedTendLandscape

/** R-3.5 The Actions that play a card, regular or special. A new card adds its row here. */
const PlaysOfCard: Partial<Readonly<Record<ActionCardKind, readonly ActionType[]>>> = {
    defend: [ActionType.PlayDefend],
    move: [ActionType.Move],
    migrate: [ActionType.Migrate],
    influence: [ActionType.Influence],
    tax: [ActionType.Tax],
    improve: [ActionType.Improve, ActionType.TendLandscape]
}

/** R-3.2 The turn player plays one card, then its follow-ups run. */
export class PlayingCardsStateHandler implements MachineStateHandler<
    HydratedCardPlay,
    HydratedFeudumGameState
> {
    isValidAction(
        action: HydratedAction,
        _context: MachineContext<HydratedFeudumGameState>
    ): action is HydratedCardPlay {
        return (
            isForfeitCard(action) ||
            isPlayDefend(action) ||
            isMove(action) ||
            isMigrate(action) ||
            isInfluence(action) ||
            isTax(action) ||
            isImprove(action) ||
            isTendLandscape(action)
        )
    }

    /** R-3.2, R-3.15 Forfeit always; each card in the hand or open to a replay, by its Actions. */
    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedFeudumGameState>
    ): ActionType[] {
        const state = context.gameState
        const { hand } = state.getPlayerState(playerId)
        if (state.flow.turn?.playerId !== playerId || !hand) {
            return []
        }
        const kinds = new Set([
            ...hand,
            ...cardPlayOffers(state, playerId).repeats.map((offer) => offer.kind)
        ])
        return [ActionType.ForfeitCard, ...[...kinds].flatMap((kind) => PlaysOfCard[kind] ?? [])]
    }

    enter(context: MachineContext<HydratedFeudumGameState>) {
        askCardTurn(context.gameState)
    }

    onAction(
        _action: HydratedCardPlay,
        context: MachineContext<HydratedFeudumGameState>
    ): MachineState {
        return stateAfterCardStep(context.gameState)
    }
}
