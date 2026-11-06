import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { cardPlayOffers } from '../actions/cardPlay.js'
import { defenderAsked } from '../actions/combat.js'
import { HydratedConquer, isConquer } from '../actions/conquer.js'
import { HydratedDiscardWrit, isDiscardWrit } from '../actions/discardWrit.js'
import { HydratedExplore, isExplore } from '../actions/explore.js'
import { HydratedForfeitCard, isForfeitCard } from '../actions/forfeitCard.js'
import { HydratedGuildAction, isGuildAction } from '../actions/guildAction.js'
import { HydratedHarvest, isHarvest } from '../actions/harvest.js'
import { HydratedImprove, isImprove } from '../actions/improve.js'
import { HydratedInfluence, isInfluence } from '../actions/influence.js'
import { HydratedMigrate, isMigrate } from '../actions/migrate.js'
import { HydratedMove, isMove } from '../actions/move.js'
import { HydratedPlayDefend, isPlayDefend } from '../actions/playDefend.js'
import {
    HydratedReclaimImmunitySeal,
    isReclaimImmunitySeal,
    reclaimImmunitySealOffers
} from '../actions/reclaimImmunitySeal.js'
import { HydratedStarveThePeople, isStarveThePeople } from '../actions/starveThePeople.js'
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
    | HydratedExplore
    | HydratedImprove
    | HydratedTendLandscape
    | HydratedHarvest
    | HydratedGuildAction
    | HydratedConquer
    | HydratedStarveThePeople

/**
 * R-3.2, R-4.4.4, R-3.14-H2 What the turn player may send here. A discard or a reclaimed seal plays
 * no card, so ends no step.
 */
type PlayingCardsAction = HydratedCardPlay | HydratedDiscardWrit | HydratedReclaimImmunitySeal

/** R-3.5 The Actions that play a card, regular or special. A new card adds its row here. */
const PlaysOfCard: Partial<Readonly<Record<ActionCardKind, readonly ActionType[]>>> = {
    defend: [ActionType.PlayDefend],
    move: [ActionType.Move],
    migrate: [ActionType.Migrate],
    influence: [ActionType.Influence],
    tax: [ActionType.Tax],
    explore: [ActionType.Explore],
    improve: [ActionType.Improve, ActionType.TendLandscape],
    harvest: [ActionType.Harvest],
    guild: [ActionType.GuildAction],
    conquer: [ActionType.Conquer, ActionType.StarveThePeople]
}

/** R-3.2 The turn player plays one card, then its follow-ups run. */
export class PlayingCardsStateHandler implements MachineStateHandler<
    PlayingCardsAction,
    HydratedFeudumGameState
> {
    isValidAction(
        action: HydratedAction,
        _context: MachineContext<HydratedFeudumGameState>
    ): action is PlayingCardsAction {
        return (
            isForfeitCard(action) ||
            isPlayDefend(action) ||
            isMove(action) ||
            isMigrate(action) ||
            isInfluence(action) ||
            isTax(action) ||
            isExplore(action) ||
            isDiscardWrit(action) ||
            isImprove(action) ||
            isTendLandscape(action) ||
            isHarvest(action) ||
            isGuildAction(action) ||
            isConquer(action) ||
            isStarveThePeople(action) ||
            isReclaimImmunitySeal(action)
        )
    }

    /** R-3.2, R-3.15 Forfeit always; each card in the hand or open to a replay, by its Actions. */
    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedFeudumGameState>
    ): ActionType[] {
        const state = context.gameState
        const { hand, writCount } = state.getPlayerState(playerId)
        if (state.flow.turn?.playerId !== playerId || !hand) {
            return []
        }
        const kinds = new Set([
            ...hand,
            ...cardPlayOffers(state, playerId).repeats.map((offer) => offer.kind)
        ])
        return [
            ActionType.ForfeitCard,
            ...[...kinds].flatMap((kind) => PlaysOfCard[kind] ?? []),
            ...(writCount > 0 ? [ActionType.DiscardWrit] : []),
            ...(reclaimImmunitySealOffers(state, playerId).length > 0
                ? [ActionType.ReclaimImmunitySeal]
                : [])
        ]
    }

    enter(context: MachineContext<HydratedFeudumGameState>) {
        askCardTurn(context.gameState)
    }

    onAction(
        action: PlayingCardsAction,
        context: MachineContext<HydratedFeudumGameState>
    ): MachineState {
        if (isDiscardWrit(action) || isReclaimImmunitySeal(action)) {
            return MachineState.PlayingCards
        }
        const { combat, starve } = context.gameState.flow
        if (starve) {
            return MachineState.AwaitingImmunity
        }
        if (combat) {
            return defenderAsked(context.gameState, combat.defenderId)
                ? MachineState.AwaitingDefence
                : MachineState.CommittingAttack
        }
        return stateAfterCardStep(context.gameState)
    }
}
