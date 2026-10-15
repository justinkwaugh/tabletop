import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
    AxialCoordinates,
    GameAction,
    HydratableAction,
    MachineContext,
    sameCoordinates
} from '@tabletop/common'
import { HydratedZertzGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { MarbleColor } from '../model/marbles.js'

export type CaptureMetadata = Type.Static<typeof CaptureMetadata>
export const CaptureMetadata = Type.Object({
    jumper: Type.Enum(MarbleColor),
    over: AxialCoordinates,
    captured: Type.Enum(MarbleColor),
    continues: Type.Boolean()
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

    apply(state: HydratedZertzGameState, _context?: MachineContext) {
        const jump = state.board.findJump(this.from, this.to)
        if (jump === undefined || !this.isValid(state)) {
            throw Error('Invalid Capture action')
        }
        const { jumper, captured } = state.board.jump(jump)
        state.getPlayerState(this.playerId).capture(captured)
        state.concludeMove(this.playerId)

        const continues = !state.isOver && state.board.jumpsFrom(this.to).length > 0
        if (continues) {
            state.captureChainFrom = structuredClone(this.to)
        } else {
            delete state.captureChainFrom
        }
        this.metadata = { jumper, over: jump.over, captured, continues }
    }

    isValid(state: HydratedZertzGameState): boolean {
        const chainFrom = state.captureChainFrom
        if (chainFrom !== undefined && !sameCoordinates(chainFrom, this.from)) {
            return false
        }
        return state.board.findJump(this.from, this.to) !== undefined
    }
}
