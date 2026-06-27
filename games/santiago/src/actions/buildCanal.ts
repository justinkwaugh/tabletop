import * as Type from 'typebox'
import { GameAction, HydratableAction } from '@tabletop/common'
import { Compile } from 'typebox/compile'
import { ActionType } from '../definition/actions.js'
import { HydratedSantiagoGameState } from '../model/gameState.js'
import { CanalSegment, isSameSegment } from '../model/board.js'
import { isConnectedToSpring, isCanalPlaced } from '../util/irrigation.js'

export type BuildCanal = Type.Static<typeof BuildCanal>
export const BuildCanal = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['type']),
        Type.Object({
            type: Type.Literal(ActionType.BuildCanal),
            segment: CanalSegment
        })
    ])
)

export const BuildCanalValidator = Compile(BuildCanal)

export function isBuildCanal(action: GameAction): action is BuildCanal {
    return action.type === ActionType.BuildCanal
}

export class HydratedBuildCanal extends HydratableAction<typeof BuildCanal> implements BuildCanal {
    declare type: ActionType.BuildCanal
    declare segment: CanalSegment

    constructor(data: BuildCanal) {
        super(data, BuildCanalValidator)
    }

    apply(state: HydratedSantiagoGameState) {
        if (isCanalPlaced(state.board, this.segment)) {
            throw new Error('Canal segment is already placed')
        }
        if (!isConnectedToSpring(state.board, this.segment)) {
            throw new Error('Canal segment is not connected to the spring network')
        }
        state.board.canals.push(this.segment)
    }
}
