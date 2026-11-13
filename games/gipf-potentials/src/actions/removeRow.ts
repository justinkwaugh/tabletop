import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { AxialCoordinates, GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedGipfPotentialsGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import { Unit } from '../model/pieces.js'

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
        const mayRemoveNow =
            state.machineState === MachineState.ResolvingRows
                ? state.resolvingPlayerIds[0] === this.playerId &&
                  state.mayTakeRow(this.playerId, row)
                : !board.isMandatory(row)
        return mayRemoveNow && board.isValidRemoval(row, this.keep)
    }
}
