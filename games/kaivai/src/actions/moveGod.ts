import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { AxialCoordinates, GameAction, HydratableAction } from '@tabletop/common'
import { HydratedKaivaiGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { CellType, CultCell } from '../definition/cells.js'

export type MoveGodMetadata = Type.Static<typeof MoveGodMetadata>
export const MoveGodMetadata = Type.Object({
    originalCoords: Type.Optional(AxialCoordinates),
    influenceGained: Type.Record(Type.String(), Type.Number())
})

export type MoveGod = Type.Static<typeof MoveGod>
export const MoveGod = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.MoveGod),
            playerId: Type.String(),
            coords: AxialCoordinates,
            metadata: Type.Optional(MoveGodMetadata)
        })
    ])
)

export const MoveGodValidator = Compile(MoveGod)

export function isMoveGod(action?: GameAction): action is MoveGod {
    return action?.type === ActionType.MoveGod
}

export class HydratedMoveGod extends HydratableAction<typeof MoveGod> implements MoveGod {
    declare type: ActionType.MoveGod
    declare playerId: string
    declare coords: AxialCoordinates
    declare metadata?: MoveGodMetadata

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

        this.metadata = { originalCoords: state.godLocation?.coords, influenceGained: {} }

        state.godLocation = { coords: this.coords, islandId: cultCell.islandId }

        const island = state.board.islands[cultCell.islandId]
        for (const coords of island.coordList) {
            const cell = state.board.getCellAt(coords)
            if (cell.type === CellType.Meeting) {
                const playerState = state.getPlayerState(cell.owner)
                playerState.influence += 1
                const gained = this.metadata.influenceGained[cell.owner] ?? 0
                this.metadata.influenceGained[cell.owner] = gained + 1
            }
        }
    }

    static isValidPlacement(
        state: HydratedKaivaiGameState,
        coords: AxialCoordinates
    ): { valid: boolean; reason: string } {
        const board = state.board

        if (!board.isWaterCell(coords)) {
            return { valid: false, reason: 'New cult site must be placed on water' }
        }

        if (board.getBoatAt(coords)) {
            return { valid: false, reason: 'Destination cell must be empty' }
        }

        const neighboringIslands = board.getNeighboringIslands(coords)
        if (neighboringIslands.length > 1) {
            return { valid: false, reason: 'New cult site must not connect more than one island' }
        }

        if (neighboringIslands.length === 0) {
            return { valid: false, reason: 'New cult site must be adjacent to an island' }
        }

        if (board.willTrapBoats(coords)) {
            return { valid: false, reason: 'Boats may not be surrounded by island' }
        }

        if (state.godLocation && state.godLocation.islandId === neighboringIslands[0]) {
            return { valid: false, reason: 'God must be placed on a different island' }
        }

        return { valid: true, reason: '' }
    }
}
