import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { EventResolution, resolveNextEventAttempt } from '../model/events.js'
import type { HydratedStellarHorizonsGameState } from '../model/gameState.js'

export type ResolveEvent = Type.Static<typeof ResolveEvent>
export const ResolveEvent = Type.Evaluate(
    Type.Intersect([
        GameAction,
        Type.Object({
            type: Type.Literal(ActionType.ResolveEvent),
            metadata: Type.Optional(EventResolution)
        })
    ])
)

export const ResolveEventValidator = Compile(ResolveEvent)

export function isResolveEvent(action?: GameAction): action is ResolveEvent {
    return action?.type === ActionType.ResolveEvent
}

export class HydratedResolveEvent
    extends HydratableAction<typeof ResolveEvent>
    implements ResolveEvent
{
    declare type: ActionType.ResolveEvent
    declare metadata?: EventResolution

    constructor(data: ResolveEvent) {
        super(data, ResolveEventValidator)
    }

    apply(state: HydratedStellarHorizonsGameState, _context?: MachineContext) {
        this.metadata = resolveNextEventAttempt(state)
    }
}
