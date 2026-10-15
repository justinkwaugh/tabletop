import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { CoralColor } from '../components/colors.js'
import { HydratedReefEncounterGameState } from '../model/gameState.js'

// Actions 2 and 3: a larva cube is shown and returned to the supply, and polyps of its colour follow.
export type PlayLarvaCube = Type.Static<typeof PlayLarvaCube>
export const PlayLarvaCube = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.PlayLarvaCube),
            playerId: Type.String(),
            color: Type.Enum(CoralColor)
        })
    ])
)

export const PlayLarvaCubeValidator = Compile(PlayLarvaCube)

export function isPlayLarvaCube(action?: GameAction): action is PlayLarvaCube {
    return action?.type === ActionType.PlayLarvaCube
}

export class HydratedPlayLarvaCube
    extends HydratableAction<typeof PlayLarvaCube>
    implements PlayLarvaCube
{
    declare type: ActionType.PlayLarvaCube
    declare playerId: string
    declare color: CoralColor

    constructor(data: PlayLarvaCube) {
        super(data, PlayLarvaCubeValidator)
    }

    apply(state: HydratedReefEncounterGameState) {
        state.playLarvaCube(this.playerId, this.color)
    }
}
