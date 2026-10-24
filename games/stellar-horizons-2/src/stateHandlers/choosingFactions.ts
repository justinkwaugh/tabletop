import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { HydratedChooseFaction, isChooseFaction } from '../actions/chooseFaction.js'
import { ActionType } from '../definition/actions.js'
import { oweFirstDirectives, usesDirectives } from '../model/directives.js'
import { MachineState } from '../definition/states.js'
import { isCampaign } from '../model/campaign.js'
import { oweHandDraws } from '../model/cards.js'
import type { HydratedStellarHorizonsGameState } from '../model/gameState.js'
import { CardsResume } from '../model/pieces.js'
import { nextStartingBasePlacer } from '../model/startingBases.js'
import { stateForCardDraws } from './transitions.js'

export class ChoosingFactionsStateHandler implements MachineStateHandler<
    HydratedChooseFaction,
    HydratedStellarHorizonsGameState
> {
    isValidAction(
        action: HydratedAction,
        _context: MachineContext<HydratedStellarHorizonsGameState>
    ): action is HydratedChooseFaction {
        return isChooseFaction(action)
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedStellarHorizonsGameState>
    ): ActionType[] {
        return context.gameState.isActivePlayer(playerId) ? [ActionType.ChooseFaction] : []
    }

    enter(context: MachineContext<HydratedStellarHorizonsGameState>) {
        const state = context.gameState
        const next = this.nextChooser(state)
        state.activePlayerIds = next ? [next] : []
    }

    onAction(
        _action: HydratedChooseFaction,
        context: MachineContext<HydratedStellarHorizonsGameState>
    ): MachineState {
        const state = context.gameState
        if (this.nextChooser(state)) {
            return MachineState.ChoosingFactions
        }
        if (nextStartingBasePlacer(state)) {
            return MachineState.PlacingStartingBases
        }
        // The campaign deals each hand (setup step 13), then begins in the exploration phase of
        // its first turn (rulebook 3.0).
        if (!isCampaign(state)) {
            return MachineState.StartOfTurn
        }
        for (const playerId of state.initiativeOrder()) {
            oweHandDraws(state, playerId)
        }
        if (usesDirectives(state)) {
            oweFirstDirectives(state)
        }
        return stateForCardDraws(state, CardsResume.Setup)
    }

    private nextChooser(state: HydratedStellarHorizonsGameState): string | undefined {
        return state
            .initiativeOrder()
            .find((playerId) => state.getPlayerState(playerId).faction === undefined)
    }
}
