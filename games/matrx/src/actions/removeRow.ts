import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
    AxialCoordinates,
    GameAction,
    HydratableAction,
    MachineContext,
    sameCoordinates
} from '@tabletop/common'
import { HydratedMatrxGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { Unit } from '../model/board.js'

export const RemovedUnit = Type.Object({ coords: AxialCoordinates, unit: Unit })

export type RemoveRowMetadata = Type.Static<typeof RemoveRowMetadata>
export const RemoveRowMetadata = Type.Object({
    removed: Type.Array(RemovedUnit)
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

// Rule E1: every single piece in the row's reach goes; stacks of two may stay, but the row of
// four must be broken.
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

    apply(state: HydratedMatrxGameState, _context?: MachineContext) {
        const row = state.board.findRow(this.playerId, this.from, this.to)
        if (row === undefined || !this.isValid(state)) {
            throw Error('Invalid RemoveRow action')
        }
        const removed = state.removeRow(this.playerId, row, this.keep)
        this.metadata = { removed: structuredClone(removed) }
    }

    isValid(state: HydratedMatrxGameState): boolean {
        const row = state.board.findRow(this.playerId, this.from, this.to)
        if (row === undefined || state.resolvingPlayerIds[0] !== this.playerId) {
            return false
        }
        const kept = (coords: AxialCoordinates) =>
            this.keep.some((keep) => sameCoordinates(keep, coords))
        const keepsOnlyPairsInReach = this.keep.every(
            (coords) =>
                row.reach.some((reach) => sameCoordinates(reach, coords)) &&
                state.board.topAt(coords)?.paired === true
        )
        return keepsOnlyPairsInReach && row.run.some((coords) => !kept(coords))
    }
}
