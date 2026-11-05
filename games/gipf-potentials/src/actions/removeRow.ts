import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
    AxialCoordinates,
    GameAction,
    HydratableAction,
    MachineContext,
    sameCoordinates
} from '@tabletop/common'
import { HydratedGipfPotentialsGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import { isLoaded, Unit } from '../model/pieces.js'

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

// The top unit of every spot in the row's reach goes, but GIPF-pieces and loaded pieces may stay;
// a four holding a loaded piece must be broken (General use, rules 7–8). Outside resolving, only
// a row of GIPF-pieces alone may be taken, at the owner's choice.
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

    apply(state: HydratedGipfPotentialsGameState, _context?: MachineContext) {
        const row = state.board.findRow(this.playerId, this.from, this.to)
        if (row === undefined || !this.isValid(state)) {
            throw Error('Invalid RemoveRow action')
        }
        const removed = state.removeRow(this.playerId, row, this.keep)
        this.metadata = { removed: structuredClone(removed) }
    }

    isValid(state: HydratedGipfPotentialsGameState): boolean {
        const { board } = state
        const row = board.findRow(this.playerId, this.from, this.to)
        if (row === undefined) {
            return false
        }
        const kept = (coords: AxialCoordinates) =>
            this.keep.some((keep) => sameCoordinates(keep, coords))
        const keepsOnlyWhatMayStay = this.keep.every(
            (coords) =>
                row.reach.some((reach) => sameCoordinates(reach, coords)) && board.mayStay(coords)
        )
        const removesSomething = row.reach.some((coords) => !kept(coords))
        const breaksFour =
            !row.run.some((coords) => isLoaded(board.topAt(coords))) ||
            row.run.some((coords) => !kept(coords))
        const mayRemoveNow =
            state.machineState === MachineState.ResolvingRows
                ? state.resolvingPlayerIds[0] === this.playerId
                : !board.isMandatory(row)
        return keepsOnlyWhatMayStay && removesSomething && breaksFour && mayRemoveNow
    }
}
