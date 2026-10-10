import {
    type HydratedAction,
    type MachineStateHandler,
    MachineContext,
    assertExists
} from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import { HydratedBuildNetwork, isBuildNetwork } from '../actions/buildNetwork.js'
import { HydratedSkipBonusCube, isSkipBonusCube } from '../actions/skipBonusCube.js'
import type { HydratedHcgGameState } from '../model/gameState.js'
import { continueAfterSale } from './flow.js'

type BonusAction = HydratedBuildNetwork | HydratedSkipBonusCube

export class PlacingBonusCubeStateHandler implements MachineStateHandler<
    BonusAction,
    HydratedHcgGameState
> {
    isValidAction(
        action: HydratedAction,
        _context: MachineContext<HydratedHcgGameState>
    ): action is BonusAction {
        return isBuildNetwork(action) || isSkipBonusCube(action)
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedHcgGameState>
    ): ActionType[] {
        const state = context.gameState
        const available: [ActionType, boolean][] = [
            [ActionType.BuildNetwork, HydratedBuildNetwork.canBuild(state, playerId)],
            [ActionType.SkipBonusCube, HydratedSkipBonusCube.canSkip(state, playerId)]
        ]
        return available.filter(([, allowed]) => allowed).map(([type]) => type)
    }

    enter(context: MachineContext<HydratedHcgGameState>) {
        const bonus = context.gameState.bonusCube
        context.gameState.activePlayerIds = bonus ? [bonus.playerId] : []
    }

    onAction(action: BonusAction, context: MachineContext<HydratedHcgGameState>): MachineState {
        const state = context.gameState
        const bonus = state.bonusCube
        assertExists(bonus, 'A bonus cube is due')
        state.bonusCube = undefined
        return continueAfterSale(state, bonus.initialAuction, action.playerId)
    }
}
