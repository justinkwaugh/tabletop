import { Type, type Static } from '@sinclair/typebox'
import { TypeCompiler } from '@sinclair/typebox/compiler'
import { GameAction, HydratableAction, OffsetTupleCoordinates } from '@tabletop/common'
import { HydratedFreshFishGameState } from '../model/gameState.js'
import { CellType } from '../components/cells.js'
import { GoodsType } from '../definition/goodsType.js'
import { ActionType } from '../definition/actions.js'

export type PlaceStall = Static<typeof PlaceStall>
export const PlaceStall = Type.Composite([
    Type.Omit(GameAction, ['playerId']),
    Type.Object({
        type: Type.Literal(ActionType.PlaceStall),
        playerId: Type.String(),
        goodsType: Type.Enum(GoodsType),
        coords: Type.Optional(OffsetTupleCoordinates)
    })
])

export const PlaceStallValidator = TypeCompiler.Compile(PlaceStall)

export function isPlaceStall(action: GameAction): action is PlaceStall {
    return action.type === ActionType.PlaceStall
}

export class HydratedPlaceStall extends HydratableAction<typeof PlaceStall> implements PlaceStall {
    declare type: ActionType.PlaceStall
    declare playerId: string
    declare goodsType: GoodsType
    declare coords?: OffsetTupleCoordinates

    constructor(data: PlaceStall) {
        super(data, PlaceStallValidator)
    }

    apply(state: HydratedFreshFishGameState) {
        const playerState = state.getPlayerState(this.playerId)

        if (!this.coords && playerState.hasDiskOnBoard()) {
            throw Error('Player has has a disk on the board and so coordinates are required')
        }

        playerState.placeStall(this.goodsType, this.coords)

        if (this.coords) {
            const board = state.board
            if (!HydratedPlaceStall.isValidCellForPlacement(state, this.coords, this.playerId)) {
                throw Error(
                    `Space at ${this.coords[0]},${this.coords[1]} is not reserved by player ${this.playerId}`
                )
            }
            board.setCell(this.coords, {
                type: CellType.Stall,
                playerId: this.playerId,
                goodsType: this.goodsType
            })
            state.expropriate()
            state.score()
            playerState.addDisks(1)
        }

        delete state.chosenTile
    }

    static isValidCellForPlacement(
        state: HydratedFreshFishGameState,
        coords: OffsetTupleCoordinates,
        playerId: string
    ): boolean {
        const board = state.board
        return board.isCellReservedForPlayer(coords, playerId)
    }
}
