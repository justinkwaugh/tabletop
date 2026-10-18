import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { eventPlacementSystems } from '../model/events.js'
import type { HydratedStellarHorizonsGameState } from '../model/gameState.js'

export type PlaceEvent = Type.Static<typeof PlaceEvent>
export const PlaceEvent = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.PlaceEvent),
            playerId: Type.String(),
            systemId: Type.String()
        })
    ])
)

export const PlaceEventValidator = Compile(PlaceEvent)

export function isPlaceEvent(action?: GameAction): action is PlaceEvent {
    return action?.type === ActionType.PlaceEvent
}

export class HydratedPlaceEvent extends HydratableAction<typeof PlaceEvent> implements PlaceEvent {
    declare type: ActionType.PlaceEvent
    declare playerId: string
    declare systemId: string

    constructor(data: PlaceEvent) {
        super(data, PlaceEventValidator)
    }

    apply(state: HydratedStellarHorizonsGameState, _context?: MachineContext) {
        const placement = state.eventPlacement
        if (
            placement?.playerId !== this.playerId ||
            !eventPlacementSystems(state, this.playerId).includes(this.systemId)
        ) {
            throw Error('Invalid PlaceEvent action')
        }
        state.events.push({ eventId: placement.eventId, systemId: this.systemId })
        state.eventPlacement = undefined
    }
}
