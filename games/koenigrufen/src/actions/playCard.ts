import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction } from '@tabletop/common'
import { CardIdSchema } from '../components/cards.js'
import { ActionType } from '../definition/actions.js'
import type { HydratedKoenigrufenGameState } from '../model/gameState.js'

export type PlayCardResult = Type.Static<typeof PlayCardResult>
export const PlayCardResult = Type.Object({
    // Present when the card completed a trick.
    trickWinnerId: Type.Optional(Type.String())
})

export type PlayCard = Type.Static<typeof PlayCard>
export const PlayCard = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.PlayCard),
            playerId: Type.String(),
            cardId: CardIdSchema,
            metadata: Type.Optional(PlayCardResult)
        })
    ])
)

export const PlayCardValidator = Compile(PlayCard)

export function isPlayCard(action?: GameAction): action is PlayCard {
    return action?.type === ActionType.PlayCard
}

export class HydratedPlayCard extends HydratableAction<typeof PlayCard> implements PlayCard {
    declare type: ActionType.PlayCard
    declare playerId: string
    declare cardId: string
    declare metadata?: PlayCardResult

    constructor(data: PlayCard) {
        super(data, PlayCardValidator)
    }

    apply(state: HydratedKoenigrufenGameState) {
        const handsWereShown = state.handsShown === true
        const trickWinnerId = state.playCard(this.playerId, this.cardId)
        this.metadata = trickWinnerId === undefined ? {} : { trickWinnerId }
        // Laying the ouvert hands open reveals every hand, so the lead cannot be taken back.
        if (!handsWereShown && state.handsShown === true) {
            this.revealsInfo = true
        }
    }
}
