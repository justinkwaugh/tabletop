import {
    ActionSource,
    GameAction,
    HydratableAction,
    MachineContext,
    assert
} from '@tabletop/common'
import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import type { HydratedPromontoryPointGameState } from '../model/gameState.js'
import { RailroadIdSchema } from '../model/schemas.js'
import { revealTurnPieces } from '../rules/turnStart.js'
import { turnPlayerId } from '../rules/turnPlayer.js'

export type RevealHandMetadata = Type.Static<typeof RevealHandMetadata>
export const RevealHandMetadata = Type.Object({
    pieces: Type.Array(RailroadIdSchema)
})

export type RevealHand = Type.Static<typeof RevealHand>
export const RevealHand = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['type', 'source', 'playerId']),
        Type.Object({
            type: Type.Literal(ActionType.RevealHand),
            source: Type.Literal(ActionSource.System),
            playerId: Type.String(),
            metadata: Type.Optional(RevealHandMetadata)
        })
    ])
)

export const RevealHandValidator = Compile(RevealHand)

export function isRevealHand(action?: GameAction): action is RevealHand {
    return action?.type === ActionType.RevealHand
}

// R-2.2 step 1, R-5: the turn opens with the hand turned face up for every seat.
export class HydratedRevealHand extends HydratableAction<typeof RevealHand> implements RevealHand {
    declare type: ActionType.RevealHand
    declare source: ActionSource.System
    declare playerId: string
    declare metadata?: RevealHandMetadata

    constructor(data: RevealHand) {
        super(data, RevealHandValidator)
    }

    apply(state: HydratedPromontoryPointGameState, _context?: MachineContext) {
        assert(
            HydratedRevealHand.canRevealHand(state, this.playerId),
            'RevealHand belongs to the turn player as the turn starts'
        )
        const pieces = revealTurnPieces(state, this.playerId)
        this.metadata = { pieces }
        // R-X.2: the hand leaves concealment.
        this.revealsInfo = true
    }

    static canRevealHand(state: HydratedPromontoryPointGameState, playerId: string): boolean {
        return state.machineState === MachineState.StartingTurn && playerId === turnPlayerId(state)
    }
}
