import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext, assert } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import type { HydratedDickeKartoffelnGameState } from '../model/gameState.js'

export type CompostMove = Type.Static<typeof CompostMove>
export const CompostMove = Type.Object({
    playerId: Type.String(),
    worms: Type.Number(),
    ripened: Type.Number()
})

export type MoveCompostMetadata = Type.Static<typeof MoveCompostMetadata>
export const MoveCompostMetadata = Type.Object({ moves: Type.Array(CompostMove) })

export type MoveCompost = Type.Static<typeof MoveCompost>
export const MoveCompost = Type.Evaluate(
    Type.Intersect([
        GameAction,
        Type.Object({
            type: Type.Literal(ActionType.MoveCompost),
            metadata: Type.Optional(MoveCompostMetadata)
        })
    ])
)

export const MoveCompostValidator = Compile(MoveCompost)

export function isMoveCompost(action?: GameAction): action is MoveCompost {
    return action?.type === ActionType.MoveCompost
}

// Nature does the work for free: compost pile 1 moves onto the emptied pile 2, its worms doubled.
export class HydratedMoveCompost
    extends HydratableAction<typeof MoveCompost>
    implements MoveCompost
{
    declare type: ActionType.MoveCompost
    declare metadata?: MoveCompostMetadata

    constructor(data: MoveCompost) {
        super(data, MoveCompostValidator)
    }

    apply(state: HydratedDickeKartoffelnGameState, _context?: MachineContext) {
        const moves: CompostMove[] = []
        for (const player of state.players) {
            assert(player.ripeCompost === 0, 'Compost pile 2 must be used up first')
            if (player.freshCompost === 0) continue
            const worms = player.freshCompost
            player.ripeCompost = worms * 2
            player.freshCompost = 0
            moves.push({ playerId: player.playerId, worms, ripened: player.ripeCompost })
        }
        this.metadata = { moves }
    }
}
