import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { AxialCoordinates, GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedTzaarGameState, StackSummary } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import { isSpace } from '../model/geometry.js'
import { PieceKind } from '../model/board.js'
import { captureEndsTurn, stuckPlayerAfterTurnOf } from '../stateHandlers/turnFlow.js'

// `moved` and `captured` describe the two stacks before the capture. `opening` marks White's
// single-capture first turn and `noSecondMove` a turn that ended for want of a second move.
// `eliminatedKind` is the type the capture took the opponent's last of, which wins; otherwise
// `stuckPlayerId` names an opponent left unable to capture when their turn begins.
export type CaptureMetadata = Type.Static<typeof CaptureMetadata>
export const CaptureMetadata = Type.Object({
    moved: StackSummary,
    captured: StackSummary,
    opening: Type.Optional(Type.Boolean()),
    noSecondMove: Type.Optional(Type.Boolean()),
    eliminatedKind: Type.Optional(Type.Enum(PieceKind)),
    stuckPlayerId: Type.Optional(Type.String())
})

export type Capture = Type.Static<typeof Capture>
export const Capture = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.Capture),
            playerId: Type.String(),
            from: AxialCoordinates,
            to: AxialCoordinates,
            metadata: Type.Optional(CaptureMetadata)
        })
    ])
)

export const CaptureValidator = Compile(Capture)

export function isCapture(action?: GameAction): action is Capture {
    return action?.type === ActionType.Capture
}

export class HydratedCapture extends HydratableAction<typeof Capture> implements Capture {
    declare type: ActionType.Capture
    declare playerId: string
    declare from: AxialCoordinates
    declare to: AxialCoordinates
    declare metadata?: CaptureMetadata

    constructor(data: Capture) {
        super(data, CaptureValidator)
    }

    apply(state: HydratedTzaarGameState, _context?: MachineContext) {
        if (!this.isValid(state)) {
            throw Error('Invalid Capture action')
        }
        const opening = state.isOpeningTurn()
        const metadata: CaptureMetadata = state.capture(this.from, this.to)
        this.metadata = metadata

        const eliminatedKind = state.missingKind(state.opponentOf(this.playerId))
        if (eliminatedKind !== undefined) {
            metadata.eliminatedKind = eliminatedKind
            return
        }

        if (opening) {
            metadata.opening = true
        } else if (
            state.machineState === MachineState.Capturing &&
            !state.hasSecondMove(this.playerId)
        ) {
            metadata.noSecondMove = true
        }
        if (captureEndsTurn(state, metadata)) {
            const stuckPlayerId = stuckPlayerAfterTurnOf(state, this.playerId)
            if (stuckPlayerId !== undefined) {
                metadata.stuckPlayerId = stuckPlayerId
            }
        }
    }

    isValid(state: HydratedTzaarGameState): boolean {
        return (
            isSpace(this.from) &&
            isSpace(this.to) &&
            state.canPlayerCapture(this.playerId, this.from, this.to)
        )
    }
}
