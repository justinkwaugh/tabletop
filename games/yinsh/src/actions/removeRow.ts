import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { AxialCoordinates, GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedYinshGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'

export type RemoveRowMetadata = Type.Static<typeof RemoveRowMetadata>
export const RemoveRowMetadata = Type.Object({
    markers: Type.Array(AxialCoordinates)
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
            metadata: Type.Optional(RemoveRowMetadata)
        })
    ])
)

export const RemoveRowValidator = Compile(RemoveRow)

export function isRemoveRow(action?: GameAction): action is RemoveRow {
    return action?.type === ActionType.RemoveRow
}

// Rules G2 and G4: any five adjacent markers of the player's color in a line return to the pool.
export class HydratedRemoveRow extends HydratableAction<typeof RemoveRow> implements RemoveRow {
    declare type: ActionType.RemoveRow
    declare playerId: string
    declare from: AxialCoordinates
    declare to: AxialCoordinates
    declare metadata?: RemoveRowMetadata

    constructor(data: RemoveRow) {
        super(data, RemoveRowValidator)
    }

    apply(state: HydratedYinshGameState, _context?: MachineContext) {
        const row = state.board.findRow(this.playerId, this.from, this.to)
        if (row === undefined || !this.isValid(state)) {
            throw Error('Invalid RemoveRow action')
        }
        state.board.removeMarkers(row)
        this.metadata = { markers: structuredClone(row) }
    }

    isValid(state: HydratedYinshGameState): boolean {
        return (
            state.resolvingPlayerIds[0] === this.playerId &&
            state.board.findRow(this.playerId, this.from, this.to) !== undefined
        )
    }
}
