import {
    type HydratedAction,
    type MachineStateHandler,
    MachineContext,
    assertExists
} from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import { HydratedChooseSpoils, isChooseSpoils } from '../actions/chooseSpoils.js'
import { HydratedDivideSpoils, isDivideSpoils } from '../actions/divideSpoils.js'
import { ExpelRaider, HydratedExpelRaider, isExpelRaider } from '../actions/expelRaider.js'
import type { HydratedKoggeGameState, KoggeProjectedState } from '../model/gameState.js'
import { finishTurn } from './turnFlow.js'

type RaidProgress = NonNullable<KoggeProjectedState['raid']>

function activeRaid(state: HydratedKoggeGameState): RaidProgress {
    assertExists(state.raid, 'No raid in progress')
    return state.raid
}

export class DividingSpoilsStateHandler implements MachineStateHandler<
    HydratedDivideSpoils,
    HydratedKoggeGameState
> {
    isValidAction(
        action: HydratedAction,
        context: MachineContext<HydratedKoggeGameState>
    ): action is HydratedDivideSpoils {
        return isDivideSpoils(action) && action.playerId === context.gameState.raid?.victimId
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedKoggeGameState>
    ): ActionType[] {
        return context.gameState.raid?.victimId === playerId ? [ActionType.DivideSpoils] : []
    }

    enter(context: MachineContext<HydratedKoggeGameState>) {
        const victimId = activeRaid(context.gameState).victimId
        assertExists(victimId, 'A cog raid needs a victim')
        context.gameState.activePlayerIds = [victimId]
    }

    onAction(
        _action: HydratedDivideSpoils,
        _context: MachineContext<HydratedKoggeGameState>
    ): MachineState {
        return MachineState.ChoosingSpoils
    }
}

export class ChoosingSpoilsStateHandler implements MachineStateHandler<
    HydratedChooseSpoils,
    HydratedKoggeGameState
> {
    isValidAction(
        action: HydratedAction,
        context: MachineContext<HydratedKoggeGameState>
    ): action is HydratedChooseSpoils {
        return isChooseSpoils(action) && action.playerId === context.gameState.raid?.raiderId
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedKoggeGameState>
    ): ActionType[] {
        return context.gameState.raid?.raiderId === playerId ? [ActionType.ChooseSpoils] : []
    }

    enter(context: MachineContext<HydratedKoggeGameState>) {
        context.gameState.activePlayerIds = [activeRaid(context.gameState).raiderId]
    }

    onAction(
        _action: HydratedChooseSpoils,
        _context: MachineContext<HydratedKoggeGameState>
    ): MachineState {
        return MachineState.ExpellingRaider
    }
}

export class ExpellingRaiderStateHandler implements MachineStateHandler<
    HydratedExpelRaider,
    HydratedKoggeGameState
> {
    isValidAction(
        action: HydratedAction,
        context: MachineContext<HydratedKoggeGameState>
    ): action is HydratedExpelRaider {
        return isExpelRaider(action) && action.playerId === context.gameState.raid?.expellerId
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedKoggeGameState>
    ): ActionType[] {
        const raid = context.gameState.raid
        return raid?.expellerId === playerId &&
            context.gameState.expulsionRoutes(raid.raiderId).length > 0
            ? [ActionType.ExpelRaider]
            : []
    }

    enter(context: MachineContext<HydratedKoggeGameState>) {
        const state = context.gameState
        const raid = activeRaid(state)
        state.activePlayerIds = [raid.expellerId]
        if (state.expulsionRoutes(raid.raiderId).length === 0) {
            context.addSystemAction(ExpelRaider, { playerId: raid.expellerId })
        }
    }

    onAction(
        _action: HydratedExpelRaider,
        context: MachineContext<HydratedKoggeGameState>
    ): MachineState {
        return finishTurn(context.gameState)
    }
}
