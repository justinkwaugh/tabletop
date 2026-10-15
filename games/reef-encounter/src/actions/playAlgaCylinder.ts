import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { AlgaColor, CoralColor } from '../components/colors.js'
import { HydratedReefEncounterGameState } from '../model/gameState.js'
import { AlgaPlayed } from '../model/reef.js'

// Action 7: a consumed polyp buys an alga cylinder, played at once onto the open-sea space,
// or onto the coral tile given, which it locks.
export type PlayAlgaCylinder = Type.Static<typeof PlayAlgaCylinder>
export const PlayAlgaCylinder = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.PlayAlgaCylinder),
            playerId: Type.String(),
            consumedColor: Type.Enum(CoralColor),
            alga: Type.Enum(AlgaColor),
            tileId: Type.Optional(Type.Number()),
            metadata: Type.Optional(AlgaPlayed)
        })
    ])
)

export const PlayAlgaCylinderValidator = Compile(PlayAlgaCylinder)

export function isPlayAlgaCylinder(action?: GameAction): action is PlayAlgaCylinder {
    return action?.type === ActionType.PlayAlgaCylinder
}

export class HydratedPlayAlgaCylinder
    extends HydratableAction<typeof PlayAlgaCylinder>
    implements PlayAlgaCylinder
{
    declare type: ActionType.PlayAlgaCylinder
    declare playerId: string
    declare consumedColor: CoralColor
    declare alga: AlgaColor
    declare tileId?: number
    declare metadata?: AlgaPlayed

    constructor(data: PlayAlgaCylinder) {
        super(data, PlayAlgaCylinderValidator)
    }

    apply(state: HydratedReefEncounterGameState) {
        this.metadata = state.playAlgaCylinder(
            this.playerId,
            this.consumedColor,
            this.alga,
            this.tileId
        )
    }
}
