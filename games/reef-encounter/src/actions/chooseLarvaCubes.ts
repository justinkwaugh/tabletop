import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { CoralColor } from '../components/colors.js'
import { HydratedReefEncounterGameState } from '../model/gameState.js'

// At setup each player, in turn order, takes two larva cubes and shows them to the table.
export type ChooseLarvaCubes = Type.Static<typeof ChooseLarvaCubes>
export const ChooseLarvaCubes = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.ChooseLarvaCubes),
            playerId: Type.String(),
            colors: Type.Array(Type.Enum(CoralColor))
        })
    ])
)

export const ChooseLarvaCubesValidator = Compile(ChooseLarvaCubes)

export function isChooseLarvaCubes(action?: GameAction): action is ChooseLarvaCubes {
    return action?.type === ActionType.ChooseLarvaCubes
}

export class HydratedChooseLarvaCubes
    extends HydratableAction<typeof ChooseLarvaCubes>
    implements ChooseLarvaCubes
{
    declare type: ActionType.ChooseLarvaCubes
    declare playerId: string
    declare colors: CoralColor[]

    constructor(data: ChooseLarvaCubes) {
        super(data, ChooseLarvaCubesValidator)
    }

    apply(state: HydratedReefEncounterGameState) {
        state.takeLarvaCubes(this.playerId, this.colors)
    }
}
