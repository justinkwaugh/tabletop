import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction } from '@tabletop/common'
import { CardIdSchema } from '../components/cards.js'
import { ActionType } from '../definition/actions.js'
import type { HydratedKoenigrufenGameState } from '../model/gameState.js'

export type GivenTalonCard = Type.Static<typeof GivenTalonCard>
export const GivenTalonCard = Type.Object({
    playerId: Type.String(),
    cardId: CardIdSchema
})

// Trischaken with the talon by trick: the top talon card is shown to everyone and goes to the
// winner of the trick just completed.
export type GiveTalonCard = Type.Static<typeof GiveTalonCard>
export const GiveTalonCard = Type.Evaluate(
    Type.Intersect([
        GameAction,
        Type.Object({
            type: Type.Literal(ActionType.GiveTalonCard),
            revealsInfo: Type.Literal(true),
            metadata: Type.Optional(GivenTalonCard)
        })
    ])
)

export const GiveTalonCardValidator = Compile(GiveTalonCard)

export function isGiveTalonCard(action?: GameAction): action is GiveTalonCard {
    return action?.type === ActionType.GiveTalonCard
}

export class HydratedGiveTalonCard
    extends HydratableAction<typeof GiveTalonCard>
    implements GiveTalonCard
{
    declare type: ActionType.GiveTalonCard
    declare revealsInfo: true
    declare metadata?: GivenTalonCard

    constructor(data: GiveTalonCard) {
        super(data, GiveTalonCardValidator)
    }

    apply(state: HydratedKoenigrufenGameState) {
        this.metadata = state.giveTalonCard()
    }
}
