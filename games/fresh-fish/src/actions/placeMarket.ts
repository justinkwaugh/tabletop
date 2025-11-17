import { Type, type Static } from '@sinclair/typebox'
import { TypeCompiler } from '@sinclair/typebox/compiler'
import { GameAction, HydratableAction, OffsetTupleCoordinates } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { HydratedFreshFishGameState } from '../model/gameState.js'
import { CellType } from '../components/cells.js'

export type PlaceMarket = Static<typeof PlaceMarket>
export const PlaceMarket = Type.Composite([
    Type.Omit(GameAction, ['playerId']),
    Type.Object({
        type: Type.Literal(ActionType.PlaceMarket),
        coords: OffsetTupleCoordinates
    })
])

export const PlaceMarketValidator = TypeCompiler.Compile(PlaceMarket)

export function isPlaceMarket(action: GameAction): action is PlaceMarket {
    return action.type === ActionType.PlaceMarket
}
export class HydratedPlaceMarket
    extends HydratableAction<typeof PlaceMarket>
    implements PlaceMarket
{
    declare type: ActionType.PlaceMarket
    declare playerId: string
    declare coords: OffsetTupleCoordinates

    constructor(data: PlaceMarket) {
        super(data, PlaceMarketValidator)
    }

    apply(state: HydratedFreshFishGameState) {
        const board = state.board
        if (!HydratedPlaceMarket.isValidCellForPlacement(state, this.coords, this.playerId)) {
            throw Error(
                `Space at ${this.coords[0]},${this.coords[1]} is not reserved by player ${this.playerId}`
            )
        }

        board.setCell(this.coords, { type: CellType.Market })

        const playerState = state.getPlayerState(this.playerId)
        playerState.addDisks(1)

        state.expropriate()
        state.score()
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
