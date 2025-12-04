import { Type, type Static } from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedSolGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'

export type DrawCardsMetadata = Static<typeof DrawCardsMetadata>
export const DrawCardsMetadata = Type.Object({})

export type DrawCards = Static<typeof DrawCards>
export const DrawCards = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId', 'revealsInfo']),
        Type.Object({
            type: Type.Literal(ActionType.DrawCards),
            playerId: Type.String(),
            revealsInfo: Type.Literal(true),
            metadata: Type.Optional(DrawCardsMetadata)
        })
    ])
)

export const DrawCardsValidator = Compile(DrawCards)

export function isDrawCards(action?: GameAction): action is DrawCards {
    return action?.type === ActionType.DrawCards
}

export class HydratedDrawCards extends HydratableAction<typeof DrawCards> implements DrawCards {
    declare type: ActionType.DrawCards
    declare playerId: string
    declare revealsInfo: true
    declare metadata?: DrawCardsMetadata

    constructor(data: DrawCards) {
        super(data, DrawCardsValidator)
    }

    apply(state: HydratedSolGameState, _context?: MachineContext) {
        if (state.cardsToDraw === undefined || state.cardsToDraw <= 0) {
            throw Error('No cards should be drawn')
        }
        const cards = state.deck.drawItems(state.cardsToDraw)
        const playerState = state.getPlayerState(this.playerId)
        playerState.drawnCards = cards
        state.cardsToDraw = 0
    }
}
