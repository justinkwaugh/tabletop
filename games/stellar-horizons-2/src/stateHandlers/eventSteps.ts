import {
    type HydratedAction,
    type MachineStateHandler,
    MachineContext,
    assertExists
} from '@tabletop/common'
import { DrawEvent, HydratedDrawEvent, isDrawEvent } from '../actions/drawEvent.js'
import { HydratedPlaceEvent, isPlaceEvent } from '../actions/placeEvent.js'
import { HydratedPlaceHomesteaders, isPlaceHomesteaders } from '../actions/placeHomesteaders.js'
import { HydratedResolveEvent, ResolveEvent, isResolveEvent } from '../actions/resolveEvent.js'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import { anyEventAttempts } from '../model/events.js'
import type { HydratedStellarHorizonsGameState } from '../model/gameState.js'
import { stateAfterEventDraw, stateAfterEvents } from './transitions.js'

export class DrawingEventStateHandler implements MachineStateHandler<
    HydratedDrawEvent,
    HydratedStellarHorizonsGameState
> {
    isValidAction(action: HydratedAction): action is HydratedDrawEvent {
        return isDrawEvent(action)
    }

    validActionsForPlayer(): ActionType[] {
        return []
    }

    enter(context: MachineContext<HydratedStellarHorizonsGameState>) {
        context.gameState.activePlayerIds = []
        context.addSystemAction(DrawEvent)
    }

    onAction(
        _action: HydratedDrawEvent,
        context: MachineContext<HydratedStellarHorizonsGameState>
    ): MachineState {
        return stateAfterEventDraw(context.gameState)
    }
}

export class PlacingEventStateHandler implements MachineStateHandler<
    HydratedPlaceEvent,
    HydratedStellarHorizonsGameState
> {
    isValidAction(action: HydratedAction): action is HydratedPlaceEvent {
        return isPlaceEvent(action)
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedStellarHorizonsGameState>
    ): ActionType[] {
        return context.gameState.isActivePlayer(playerId) ? [ActionType.PlaceEvent] : []
    }

    enter(context: MachineContext<HydratedStellarHorizonsGameState>) {
        const placement = context.gameState.eventPlacement
        assertExists(placement, 'Placing an event requires a drawn event')
        context.gameState.activePlayerIds = [placement.playerId]
    }

    onAction(
        _action: HydratedPlaceEvent,
        context: MachineContext<HydratedStellarHorizonsGameState>
    ): MachineState {
        return stateAfterEventDraw(context.gameState)
    }
}

export class PlacingHomesteadersStateHandler implements MachineStateHandler<
    HydratedPlaceHomesteaders,
    HydratedStellarHorizonsGameState
> {
    isValidAction(action: HydratedAction): action is HydratedPlaceHomesteaders {
        return isPlaceHomesteaders(action)
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedStellarHorizonsGameState>
    ): ActionType[] {
        return context.gameState.isActivePlayer(playerId) ? [ActionType.PlaceHomesteaders] : []
    }

    enter(context: MachineContext<HydratedStellarHorizonsGameState>) {
        context.gameState.activePlayerIds = context.gameState.homesteaders.slice(0, 1)
    }

    onAction(
        _action: HydratedPlaceHomesteaders,
        context: MachineContext<HydratedStellarHorizonsGameState>
    ): MachineState {
        return stateAfterEventDraw(context.gameState)
    }
}

export class ResolvingEventsStateHandler implements MachineStateHandler<
    HydratedResolveEvent,
    HydratedStellarHorizonsGameState
> {
    isValidAction(action: HydratedAction): action is HydratedResolveEvent {
        return isResolveEvent(action)
    }

    validActionsForPlayer(): ActionType[] {
        return []
    }

    enter(context: MachineContext<HydratedStellarHorizonsGameState>) {
        context.gameState.activePlayerIds = []
        context.addSystemAction(ResolveEvent)
    }

    onAction(
        _action: HydratedResolveEvent,
        context: MachineContext<HydratedStellarHorizonsGameState>
    ): MachineState {
        const state = context.gameState
        return anyEventAttempts(state) ? MachineState.ResolvingEvents : stateAfterEvents(state)
    }
}
