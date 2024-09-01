import { Type, type Static } from '@sinclair/typebox'
import { TypeCompiler } from '@sinclair/typebox/compiler'
import { AxialCoordinates, GameAction, HydratableAction } from '@tabletop/common'
import { HydratedKaivaiGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { CellType, CultCell } from 'src/definition/cells.js'

export type MoveGod = Static<typeof MoveGod>
export const MoveGod = Type.Composite([
    Type.Omit(GameAction, ['playerId']),
    Type.Object({
        type: Type.Literal(ActionType.MoveGod),
        playerId: Type.String(),
        coords: AxialCoordinates
    })
])

export const MoveGodValidator = TypeCompiler.Compile(MoveGod)

export function isMoveGod(action?: GameAction): action is MoveGod {
    return action?.type === ActionType.MoveGod
}

export class HydratedMoveGod extends HydratableAction<typeof MoveGod> implements MoveGod {
    declare type: ActionType.MoveGod
    declare playerId: string
    declare coords: AxialCoordinates

    constructor(data: MoveGod) {
        super(data, MoveGodValidator)
    }

    apply(state: HydratedKaivaiGameState) {
        const { valid, reason } = HydratedMoveGod.isValidPlacement(state, this.coords)

        if (!valid) {
            throw Error(reason)
        }

        const cultCell: CultCell = {
            type: CellType.Cult,
            coords: this.coords,
            islandId: state.board.getNeighboringIslands(this.coords)[0]
        }
        state.cultTiles--
        state.board.addCell(cultCell)
        state.godLocation = { coords: this.coords, islandId: cultCell.islandId }

        const island = state.board.islands[cultCell.islandId]
        for (const coords of island.coordList) {
            const cell = state.board.getCellAt(coords)
            if (cell.type === CellType.Meeting) {
                const playerState = state.getPlayerState(cell.owner)
                playerState.influence += 1
            }
        }
    }

    static isValidPlacement(
        state: HydratedKaivaiGameState,
        coords: AxialCoordinates
    ): { valid: boolean; reason: string } {
        const board = state.board

        if (!board.isInBounds(coords)) {
            return { valid: false, reason: 'Placement is off board' }
        }

        if (!board.isWaterCell(coords)) {
            return { valid: false, reason: 'New cult site must be placed on water' }
        }

        const neighboringIslands = board.getNeighboringIslands(coords)
        if (neighboringIslands.length > 1) {
            return { valid: false, reason: 'New cult site must not connect more than one island' }
        }

        if (neighboringIslands.length === 0) {
            return { valid: false, reason: 'New cult site must be adjacent to an island' }
        }

        if (board.willSurroundAnyBoats(coords)) {
            return { valid: false, reason: 'Boats may not be surrounded by island' }
        }

        if (state.godLocation && state.godLocation.islandId === neighboringIslands[0]) {
            return { valid: false, reason: 'God must be placed on a different island' }
        }

        return { valid: true, reason: '' }
    }
}
