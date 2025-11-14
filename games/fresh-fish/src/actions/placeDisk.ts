import { Type, type Static } from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction } from '@tabletop/common'
import { HydratedFreshFishGameState } from '../model/gameState.js'
import { CellType } from '../components/cells.js'
import { Coordinates } from '../components/gameBoard.js'
import { ActionType } from '../definition/actions.js'

export type PlaceDisk = Static<typeof PlaceDisk>
export const PlaceDisk = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.PlaceDisk),
            playerId: Type.String(),
            coords: Coordinates
        })
    ])
)

export const PlaceDiskValidator = Compile(PlaceDisk)

export function isPlaceDisk(action?: GameAction): action is PlaceDisk {
    return action?.type === ActionType.PlaceDisk
}

export class HydratedPlaceDisk extends HydratableAction<typeof PlaceDisk> implements PlaceDisk {
    declare type: ActionType.PlaceDisk
    declare playerId: string
    declare coords: Coordinates

    constructor(data: PlaceDisk) {
        super(data, PlaceDiskValidator)
    }

    apply(state: HydratedFreshFishGameState) {
        const playerState = state.getPlayerState(this.playerId)
        if (!playerState.hasDisk()) {
            throw Error(`Player ${this.playerId} has no disk to place`)
        }

        const board = state.board
        if (!board.isInBounds(this.coords)) {
            throw Error(`Coordinates ${this.coords[0]},${this.coords[1]} are not in bounds`)
        }

        if (!board.isEmptyCell(board.getCell(this.coords))) {
            throw Error(`Space at ${this.coords[0]},${this.coords[1]} is not empty`)
        }

        if (
            state.turnManager.turnCount(this.playerId) > 0 &&
            !board.hasOrthogonalTile(this.coords)
        ) {
            throw Error(
                `Disk at must be placed orthogonal to an populated space after the first turn`
            )
        }

        board.setCell(this.coords, { type: CellType.Disk, playerId: this.playerId })
        playerState.removeDisk()
    }

    static isValidCellForPlacement(
        state: HydratedFreshFishGameState,
        coords: Coordinates,
        playerId: string
    ): boolean {
        const board = state.board
        return (
            board.isInBounds(coords) &&
            board.isEmptyCell(board.getCell(coords)) &&
            (state.turnManager.turnCount(playerId) === 0 || board.hasOrthogonalTile(coords))
        )
    }
}
