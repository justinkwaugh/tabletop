import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
    Visibility,
    assertExists,
    GameAction,
    HydratableAction,
    MachineContext
} from '@tabletop/common'
import { HydratedLowenherzGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { PoliticsCard, samePoliticsCard, removePoliticsCard } from '../definition/politicsCards.js'

export type TakePoliticsCard = Type.Static<typeof TakePoliticsCard>
export const TakePoliticsCard = Type.Object({
    ...Type.Omit(GameAction, ['playerId']).properties,
    type: Type.Literal(ActionType.TakePoliticsCard), // This action is always this type
    playerId: Type.String(), // Required now
    // Which of the two piles the player looked through - per the rulebook,
    // they may look through only one, not both.
    pile: Type.Union([Type.Literal('A'), Type.Literal('B')]),
    card: Visibility.protect(PoliticsCard, { policy: Visibility.Policy.Actor })
    // Deliberately no revealsInfo here - the actual reveal happens in
    // LookAtPoliticsPile, which must precede this action (see
    // invalidTakePoliticsCardReason). That split means this specific pick
    // stays freely undoable: a player can undo just this action and take a
    // different card from the same already-opened pile.
})

export const TakePoliticsCardValidator = Compile(TakePoliticsCard)

export function isTakePoliticsCard(action?: GameAction): action is TakePoliticsCard {
    return action?.type === ActionType.TakePoliticsCard
}

// Crown and Scepter: the winner looks through one of the two politics-card piles and
// picks any specific card from it (not a blind/random draw) - it goes straight into
// their hand, face down, until they later play it.
export class HydratedTakePoliticsCard
    extends HydratableAction<typeof TakePoliticsCard>
    implements TakePoliticsCard
{
    declare type: ActionType.TakePoliticsCard
    declare playerId: string
    declare pile: 'A' | 'B'
    declare card: PoliticsCard

    constructor(data: TakePoliticsCard) {
        super(data, TakePoliticsCardValidator)
    }

    apply(state: HydratedLowenherzGameState, context?: MachineContext) {
        if (!this.isValidTakePoliticsCard(state)) {
            throw Error('Invalid TakePoliticsCard action')
        }

        const pile = state.getPoliticsPile(this.pile)
        const card = removePoliticsCard(pile, this.card)

        const player = state.getPlayerState(this.playerId)
        player.getPoliticsCards().push(card)
        player.syncPoliticsCardCount()
        player.politicsInspection = undefined
        if (this.pile === 'A') state.politicsPileACount = pile.length
        else state.politicsPileBCount = pile.length
        state.politicsTakingPlayerId = undefined
        state.openedPoliticsPile = undefined
    }

    isValidTakePoliticsCard(state: HydratedLowenherzGameState): boolean {
        return this.invalidTakePoliticsCardReason(state) === undefined
    }

    // Same checks as isValidTakePoliticsCard, but reports WHY a pick is rejected -
    // the client uses this to show a specific message instead of one generic one.
    invalidTakePoliticsCardReason(state: HydratedLowenherzGameState): string | undefined {
        if (state.politicsTakingPlayerId !== this.playerId) {
            return "It isn't your turn to take a politics card."
        }

        if (state.openedPoliticsPile !== this.pile) {
            return 'You need to look through a pile before picking a card from it.'
        }

        const pile = state.inspectedPoliticsCards(this.playerId)
        assertExists(pile, 'Inspected politics cards are unavailable')
        if (!pile.some((c) => samePoliticsCard(c, this.card))) {
            return "That card isn't in the pile you're looking through."
        }

        return undefined
    }
}
