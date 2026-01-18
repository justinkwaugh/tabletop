import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { assertExists, GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedSolGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { Suit } from '../components/cards.js'

export type ChooseCardMetadata = Type.Static<typeof ChooseCardMetadata>
export const ChooseCardMetadata = Type.Object({})

export type ChooseCard = Type.Static<typeof ChooseCard>
export const ChooseCard = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.ChooseCard),
            playerId: Type.String(),
            suit: Type.Enum(Suit),
            metadata: Type.Optional(ChooseCardMetadata)
        })
    ])
)

export const ChooseCardValidator = Compile(ChooseCard)

export function isChooseCard(action?: GameAction): action is ChooseCard {
    return action?.type === ActionType.ChooseCard
}

export class HydratedChooseCard extends HydratableAction<typeof ChooseCard> implements ChooseCard {
    declare type: ActionType.ChooseCard
    declare playerId: string
    declare suit: Suit
    declare metadata?: ChooseCardMetadata

    constructor(data: ChooseCard) {
        super(data, ChooseCardValidator)
    }

    apply(state: HydratedSolGameState, _context?: MachineContext) {
        const playerState = state.getPlayerState(this.playerId)
        const chosenCard = playerState.drawnCards.find((card) => card.suit === this.suit)
        assertExists(chosenCard, 'Chosen card suit not in drawn cards')

        playerState.card = chosenCard
        playerState.drawnCards = []
    }
}
