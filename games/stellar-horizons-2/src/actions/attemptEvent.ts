import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { AnomalyChallenge } from '../components/anomalies.js'
import { ActionType } from '../definition/actions.js'
import { commitEventAttempt, isValidEventAttempt } from '../model/events.js'
import type { HydratedStellarHorizonsGameState } from '../model/gameState.js'

export type AttemptEvent = Type.Static<typeof AttemptEvent>
export const AttemptEvent = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.AttemptEvent),
            playerId: Type.String(),
            eventId: Type.String(),
            challenge: Type.Enum(AnomalyChallenge),
            shipIds: Type.Array(Type.String())
        })
    ])
)

export const AttemptEventValidator = Compile(AttemptEvent)

export function isAttemptEvent(action?: GameAction): action is AttemptEvent {
    return action?.type === ActionType.AttemptEvent
}

export class HydratedAttemptEvent
    extends HydratableAction<typeof AttemptEvent>
    implements AttemptEvent
{
    declare type: ActionType.AttemptEvent
    declare playerId: string
    declare eventId: string
    declare challenge: AnomalyChallenge
    declare shipIds: string[]

    constructor(data: AttemptEvent) {
        super(data, AttemptEventValidator)
    }

    apply(state: HydratedStellarHorizonsGameState, _context?: MachineContext) {
        if (
            !isValidEventAttempt(state, this.playerId, this.eventId, this.challenge, this.shipIds)
        ) {
            throw Error('Invalid AttemptEvent action')
        }
        commitEventAttempt(state, this.playerId, this.eventId, this.challenge, this.shipIds)
    }
}
