import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedLowenherzGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import { ActionCardType, CardBack } from '../definition/actionCards.js'

export type DrawActionCardMetadata = Type.Static<typeof DrawActionCardMetadata>
export const DrawActionCardMetadata = Type.Object({
    // Which kind of card was flipped - the action itself doesn't otherwise carry this,
    // since it's derived from state.currentActionCard after the fact. Used by history
    // to describe the draw (and, for Mining/King is Dead, the state handler adds
    // hillScoring below once it computes the hill-power-point payout).
    cardType: Type.Optional(Type.Enum(ActionCardType)),
    // Which lettered pack this card came off. Recorded on every draw so history can spot
    // the moment the deck rolls from one pack to the next by comparing consecutive draws -
    // there's nowhere in state that remembers the previously drawn card (discardedActionCard
    // only survives for a Silver Mine), and it matters to anyone tracking which Silver Mines
    // are still to come.
    back: Type.Optional(Type.Enum(CardBack)),
    hillScoring: Type.Optional(
        Type.Array(Type.Object({ playerId: Type.String(), points: Type.Number() }))
    )
})

export type DrawActionCard = Type.Static<typeof DrawActionCard>
export const DrawActionCard = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']), // Omit playerId to redefine it
        Type.Object({
            type: Type.Literal(ActionType.DrawActionCard), // This action is always this type
            playerId: Type.String(), // Required now
            metadata: Type.Optional(DrawActionCardMetadata) // Always optional, because it is an output
        })
    ])
)

export const DrawActionCardValidator = Compile(DrawActionCard)

export function isDrawActionCard(action?: GameAction): action is DrawActionCard {
    return action?.type === ActionType.DrawActionCard
}

// Flips the next card off the top of the action deck. Only the first player performs
// this - either as a deliberate choice ("the first player turns over the top action
// card") or, when a Silver Mine card was just resolved, as an automatic cascade (see
// StartOfTurnStateHandler, which issues this as a system action in that case).
export class HydratedDrawActionCard
    extends HydratableAction<typeof DrawActionCard>
    implements DrawActionCard
{
    declare type: ActionType.DrawActionCard
    declare playerId: string
    declare metadata?: DrawActionCardMetadata

    constructor(data: DrawActionCard) {
        super(data, DrawActionCardValidator)
    }

    apply(state: HydratedLowenherzGameState, context?: MachineContext) {
        if (!this.isValidDrawActionCard(state)) {
            throw Error('Invalid DrawActionCard action')
        }

        state.currentActionCard = state.actionDeck.shift()
        this.metadata = {
            cardType: state.currentActionCard?.type,
            back: state.currentActionCard?.back
        }
    }

    isValidDrawActionCard(state: HydratedLowenherzGameState): boolean {
        return HydratedDrawActionCard.canDrawActionCard(state, this.playerId)
    }

    static canDrawActionCard(state: HydratedLowenherzGameState, playerId: string): boolean {
        return (
            state.machineState === MachineState.StartOfTurn &&
            playerId === state.firstPlayerId &&
            !state.currentActionCard &&
            state.actionDeck.length > 0
        )
    }
}
