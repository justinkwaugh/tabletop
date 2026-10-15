import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { CoralColor } from '../components/colors.js'
import { HydratedReefEncounterGameState } from '../model/gameState.js'

export type TakenFromOpenSea = Type.Static<typeof TakenFromOpenSea>
export const TakenFromOpenSea = Type.Object({
    polyps: Type.Array(Type.Enum(CoralColor))
})

// Action 10, which ends the turn: a larva cube and its polyps go into the player's supply.
export type TakeOpenSeaSpace = Type.Static<typeof TakeOpenSeaSpace>
export const TakeOpenSeaSpace = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.TakeOpenSeaSpace),
            playerId: Type.String(),
            larvaColor: Type.Enum(CoralColor),
            metadata: Type.Optional(TakenFromOpenSea)
        })
    ])
)

export const TakeOpenSeaSpaceValidator = Compile(TakeOpenSeaSpace)

export function isTakeOpenSeaSpace(action?: GameAction): action is TakeOpenSeaSpace {
    return action?.type === ActionType.TakeOpenSeaSpace
}

export class HydratedTakeOpenSeaSpace
    extends HydratableAction<typeof TakeOpenSeaSpace>
    implements TakeOpenSeaSpace
{
    declare type: ActionType.TakeOpenSeaSpace
    declare playerId: string
    declare larvaColor: CoralColor
    declare metadata?: TakenFromOpenSea

    constructor(data: TakeOpenSeaSpace) {
        super(data, TakeOpenSeaSpaceValidator)
    }

    apply(state: HydratedReefEncounterGameState) {
        this.metadata = { polyps: state.takeOpenSeaSpace(this.playerId, this.larvaColor) }
    }
}
