import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedHexGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { StoneColor } from '../model/board.js'

export type PlaceStoneMetadata = Type.Static<typeof PlaceStoneMetadata>
export const PlaceStoneMetadata = Type.Object({
    color: StoneColor,
    // Whether the stone joins the placer's two edges, which wins.
    joinsEdges: Type.Boolean()
})

export type PlaceStone = Type.Static<typeof PlaceStone>
export const PlaceStone = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.PlaceStone),
            playerId: Type.String(),
            cell: Type.String(),
            metadata: Type.Optional(PlaceStoneMetadata)
        })
    ])
)

export const PlaceStoneValidator = Compile(PlaceStone)

export function isPlaceStone(action?: GameAction): action is PlaceStone {
    return action?.type === ActionType.PlaceStone
}

export class HydratedPlaceStone extends HydratableAction<typeof PlaceStone> implements PlaceStone {
    declare type: ActionType.PlaceStone
    declare playerId: string
    declare cell: string
    declare metadata?: PlaceStoneMetadata

    constructor(data: PlaceStone) {
        super(data, PlaceStoneValidator)
    }

    apply(state: HydratedHexGameState, _context?: MachineContext) {
        if (!this.isValid(state)) {
            throw Error('Invalid PlaceStone action')
        }
        const stone = state.placeStone(this.playerId, this.cell)
        this.metadata = {
            color: stone.color,
            joinsEdges: state.board.joinsEdges(state.board.chainAt(this.cell), stone.color)
        }
    }

    isValid(state: HydratedHexGameState): boolean {
        return state.board.isVacant(this.cell)
    }
}
