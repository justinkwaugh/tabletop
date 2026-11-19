import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { ActionSource, GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { beginPhase, PhaseName } from '../definition/phases.js'
import type { HydratedFeudumGameState } from '../model/gameState.js'
import type { HydratedFeudumPlayerState } from '../model/playerState.js'
import { ComponentCount, PawnNumberSchema } from '../model/stateSchemas.js'

export type StartRoundMetadata = Type.Static<typeof StartRoundMetadata>
export const StartRoundMetadata = Type.Object({
    /** R-2.2 */
    round: ComponentCount,
    /** R-4.10.2 The pawns wine fed last round, drunk for this one. */
    drunk: Type.Array(Type.Object({ playerId: Type.String(), n: PawnNumberSchema }))
})

export type StartRound = Type.Static<typeof StartRound>
export const StartRound = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['source']),
        Type.Object({
            type: Type.Literal(ActionType.StartRound),
            source: Type.Literal(ActionSource.System),
            metadata: Type.Optional(StartRoundMetadata)
        })
    ])
)

export const StartRoundValidator = Compile(StartRound)

export function isStartRound(action?: GameAction): action is StartRound {
    return action?.type === ActionType.StartRound
}

/** R-4.10.2 A pawn wine fed last round is drunk for this one. */
function turnWineDrunk(player: HydratedFeudumPlayerState): StartRoundMetadata['drunk'] {
    return player.pawns.flatMap((pawn) => {
        if (pawn.wine !== 'fed') {
            return []
        }
        pawn.wine = 'drunk'
        return [{ playerId: player.playerId, n: pawn.n }]
    })
}

export class HydratedStartRound extends HydratableAction<typeof StartRound> implements StartRound {
    declare type: ActionType.StartRound
    declare source: ActionSource.System
    declare metadata?: StartRoundMetadata

    constructor(data: StartRound) {
        super(data, StartRoundValidator)
    }

    /** R-2.2, R-3.1-H1, R-4.10.2 The next round begun, every seat selecting. */
    apply(state: HydratedFeudumGameState, _context?: MachineContext) {
        const { number } = state.roundManager.startRound(state.actionCount)
        beginPhase(state, PhaseName.HandSelection)
        const drunk = state.players.flatMap(turnWineDrunk)
        state.flow.selection = { finalised: [] }
        this.metadata = { round: number, drunk }
    }
}
