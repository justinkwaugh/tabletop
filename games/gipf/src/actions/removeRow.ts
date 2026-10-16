import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { AxialCoordinates, GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedGipfGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import { Piece } from '../model/board.js'

export const RemovedPieceRecord = Type.Intersect([Piece, Type.Object({ coords: AxialCoordinates })])

export type RemoveRowMetadata = Type.Static<typeof RemoveRowMetadata>
export const RemoveRowMetadata = Type.Object({
    removed: Type.Array(RemovedPieceRecord)
})

export type RemoveRow = Type.Static<typeof RemoveRow>
export const RemoveRow = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.RemoveRow),
            playerId: Type.String(),
            from: AxialCoordinates,
            to: AxialCoordinates,
            keep: Type.Array(AxialCoordinates),
            metadata: Type.Optional(RemoveRowMetadata)
        })
    ])
)

export const RemoveRowValidator = Compile(RemoveRow)

export function isRemoveRow(action?: GameAction): action is RemoveRow {
    return action?.type === ActionType.RemoveRow
}

export class HydratedRemoveRow extends HydratableAction<typeof RemoveRow> implements RemoveRow {
    declare type: ActionType.RemoveRow
    declare playerId: string
    declare from: AxialCoordinates
    declare to: AxialCoordinates
    declare keep: AxialCoordinates[]
    declare metadata?: RemoveRowMetadata

    constructor(data: RemoveRow) {
        super(data, RemoveRowValidator)
    }

    apply(state: HydratedGipfGameState, _context?: MachineContext) {
        const row = state.board.findRow(this.playerId, this.from, this.to)
        if (row === undefined || !this.isValid(state)) {
            throw Error('Invalid RemoveRow action')
        }
        const removed = state.removeRow(this.playerId, row, this.keep)
        this.metadata = { removed: structuredClone(removed) }
    }

    isValid(state: HydratedGipfGameState): boolean {
        const row = state.board.findRow(this.playerId, this.from, this.to)
        if (row === undefined) {
            return false
        }
        const keepsOnlyGipfInReach = this.keep.every(
            (coords) =>
                row.reach.some((reach) => reach.q === coords.q && reach.r === coords.r) &&
                state.board.pieceAt(coords)?.gipf === true
        )
        const removesSomething = row.reach.length > this.keep.length
        const mayRemoveNow =
            state.machineState === MachineState.ResolvingRows
                ? state.resolvingPlayerIds[0] === this.playerId
                : !state.board.isMandatory(row)
        return keepsOnlyGipfInReach && removesSomething && mayRemoveNow
    }
}
