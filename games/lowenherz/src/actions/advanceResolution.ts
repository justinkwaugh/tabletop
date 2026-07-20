import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { HydratedLowenherzGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'

export type AdvanceResolutionMetadata = Type.Static<typeof AdvanceResolutionMetadata>
export const AdvanceResolutionMetadata = Type.Object({})

// A system-only action - never submitted by a real player (see ResolvingActionsStateHandler,
// which enqueues it via context.addSystemAction every time it's entered). playerId is
// always '' so the generic engine's active-player check is bypassed rather than tied to
// whichever player happens to be active at the time.
export type AdvanceResolution = Type.Static<typeof AdvanceResolution>
export const AdvanceResolution = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.AdvanceResolution),
            playerId: Type.String(),
            metadata: Type.Optional(AdvanceResolutionMetadata)
        })
    ])
)

export const AdvanceResolutionValidator = Compile(AdvanceResolution)

export function isAdvanceResolution(action?: GameAction): action is AdvanceResolution {
    return action?.type === ActionType.AdvanceResolution
}

export class HydratedAdvanceResolution
    extends HydratableAction<typeof AdvanceResolution>
    implements AdvanceResolution
{
    declare type: ActionType.AdvanceResolution
    declare playerId: string
    declare metadata?: AdvanceResolutionMetadata

    constructor(data: AdvanceResolution) {
        super(data, AdvanceResolutionValidator)
    }

    apply(state: HydratedLowenherzGameState, context?: MachineContext) {
        // All the real work happens in ResolvingActionsStateHandler.onAction, which has
        // access to the MachineContext needed to enqueue further cascaded actions.
        this.metadata = {}
    }
}
