import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, OffsetCoordinates } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { ReefBoardIdSchema, type ReefBoardId } from '../components/reefBoards.js'
import { HydratedReefEncounterGameState } from '../model/gameState.js'
import { PolypPlacement } from '../model/reef.js'

export type PlacePolyp = Type.Static<typeof PlacePolyp>
export const PlacePolyp = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.PlacePolyp),
            playerId: Type.String(),
            boardId: ReefBoardIdSchema,
            coords: OffsetCoordinates,
            fromConsumed: Type.Boolean(),
            metadata: Type.Optional(PolypPlacement)
        })
    ])
)

export const PlacePolypValidator = Compile(PlacePolyp)

export function isPlacePolyp(action?: GameAction): action is PlacePolyp {
    return action?.type === ActionType.PlacePolyp
}

export class HydratedPlacePolyp extends HydratableAction<typeof PlacePolyp> implements PlacePolyp {
    declare type: ActionType.PlacePolyp
    declare playerId: string
    declare boardId: ReefBoardId
    declare coords: OffsetCoordinates
    declare fromConsumed: boolean
    declare metadata?: PolypPlacement

    constructor(data: PlacePolyp) {
        super(data, PlacePolypValidator)
    }

    apply(state: HydratedReefEncounterGameState) {
        this.metadata = state.placePolyp(
            this.playerId,
            this.boardId,
            this.coords,
            this.fromConsumed
        )
    }
}
