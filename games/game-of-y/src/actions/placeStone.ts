import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedYGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { Stone } from '../model/board.js'

export type PlaceStoneMetadata = Type.Static<typeof PlaceStoneMetadata>
export const PlaceStoneMetadata = Type.Object({
    stone: Stone,
    formsY: Type.Boolean()
})

export type PlaceStone = Type.Static<typeof PlaceStone>
export const PlaceStone = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.PlaceStone),
            playerId: Type.String(),
            point: Type.String(),
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
    declare point: string
    declare metadata?: PlaceStoneMetadata

    constructor(data: PlaceStone) {
        super(data, PlaceStoneValidator)
    }

    apply(state: HydratedYGameState, _context?: MachineContext) {
        if (!this.isValid(state)) {
            throw Error('Invalid PlaceStone action')
        }
        const stone = state.placeStone(this.playerId, this.point)
        this.metadata = {
            stone: structuredClone(stone),
            formsY: state.board.formsY(state.board.chainAt(this.point))
        }
    }

    isValid(state: HydratedYGameState): boolean {
        return state.board.isVacant(this.point)
    }
}
