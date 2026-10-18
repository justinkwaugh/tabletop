import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { EventTiming, eventDefinition } from '../components/events.js'
import { ActionType } from '../definition/actions.js'
import {
    EventOutcome,
    applyDrawnEvent,
    drawEvent,
    eventPlacer,
    releaseAbandonedEvents,
    triggerNextEventEffects
} from '../model/events.js'
import type { HydratedStellarHorizonsGameState } from '../model/gameState.js'

export type DrawEventMetadata = Type.Static<typeof DrawEventMetadata>
export const DrawEventMetadata = Type.Object({
    triggered: Type.Array(EventOutcome),
    eventId: Type.Optional(Type.String()),
    drawn: Type.Optional(EventOutcome),
    placerId: Type.Optional(Type.String())
})

export type DrawEvent = Type.Static<typeof DrawEvent>
export const DrawEvent = Type.Evaluate(
    Type.Intersect([
        GameAction,
        Type.Object({
            type: Type.Literal(ActionType.DrawEvent),
            metadata: Type.Optional(DrawEventMetadata)
        })
    ])
)

export const DrawEventValidator = Compile(DrawEvent)

export function isDrawEvent(action?: GameAction): action is DrawEvent {
    return action?.type === ActionType.DrawEvent
}

// Rulebook 4.2: challenges still unresolved from the last event act first; then a new event is
// drawn. One without a challenge acts and returns to the pool; a challenge is placed by the
// Player with the worst initiative who has a base, or ignored if nobody has one.
export class HydratedDrawEvent extends HydratableAction<typeof DrawEvent> implements DrawEvent {
    declare type: ActionType.DrawEvent
    declare metadata?: DrawEventMetadata

    constructor(data: DrawEvent) {
        super(data, DrawEventValidator)
    }

    apply(state: HydratedStellarHorizonsGameState, _context?: MachineContext) {
        const triggered = triggerNextEventEffects(state)
        releaseAbandonedEvents(state)
        const eventId = drawEvent(state)
        if (eventId === undefined) {
            this.metadata = { triggered }
            return
        }
        const definition = eventDefinition(eventId)
        if (definition.timing === EventTiming.Drawn) {
            const drawn = applyDrawnEvent(state, definition)
            state.eventPool.push(eventId)
            this.metadata = { triggered, eventId, drawn }
            return
        }
        const placerId = eventPlacer(state)
        if (placerId === undefined) {
            state.eventPool.push(eventId)
        } else {
            state.eventPlacement = { eventId, playerId: placerId }
        }
        this.metadata = { triggered, eventId, placerId }
    }
}
