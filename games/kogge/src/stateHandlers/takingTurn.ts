import { type HydratedAction, type MachineStateHandler, MachineContext } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import { HydratedBuildOffice, isBuildOffice } from '../actions/buildOffice.js'
import { HydratedBuyRouteMarkers, isBuyRouteMarkers } from '../actions/buyRouteMarkers.js'
import { HydratedChangeRoute, isChangeRoute } from '../actions/changeRoute.js'
import { HydratedClaimBonusChit, isClaimBonusChit } from '../actions/claimBonusChit.js'
import { HydratedClaimRaidMarker, isClaimRaidMarker } from '../actions/claimRaidMarker.js'
import { HydratedEndTurn, isEndTurn } from '../actions/endTurn.js'
import {
    HydratedExchangeGoodForMarker,
    isExchangeGoodForMarker
} from '../actions/exchangeGoodForMarker.js'
import {
    HydratedExchangeMarkerForGood,
    isExchangeMarkerForGood
} from '../actions/exchangeMarkerForGood.js'
import { HydratedRaidCity, isRaidCity } from '../actions/raidCity.js'
import { HydratedRaidCog, isRaidCog } from '../actions/raidCog.js'
import { HydratedSail, isSail } from '../actions/sail.js'
import { HydratedTradeGoods, isTradeGoods } from '../actions/tradeGoods.js'
import type { HydratedKoggeGameState } from '../model/gameState.js'
import { finishGameDuringTurn, finishTurn } from './turnFlow.js'

type TakingTurnAction =
    | HydratedSail
    | HydratedBuildOffice
    | HydratedBuyRouteMarkers
    | HydratedTradeGoods
    | HydratedChangeRoute
    | HydratedClaimRaidMarker
    | HydratedClaimBonusChit
    | HydratedExchangeGoodForMarker
    | HydratedExchangeMarkerForGood
    | HydratedRaidCity
    | HydratedRaidCog
    | HydratedEndTurn

export class TakingTurnStateHandler implements MachineStateHandler<
    TakingTurnAction,
    HydratedKoggeGameState
> {
    isValidAction(
        action: HydratedAction,
        context: MachineContext<HydratedKoggeGameState>
    ): action is TakingTurnAction {
        const isTurnAction =
            isSail(action) ||
            isBuildOffice(action) ||
            isBuyRouteMarkers(action) ||
            isTradeGoods(action) ||
            isChangeRoute(action) ||
            isClaimRaidMarker(action) ||
            isClaimBonusChit(action) ||
            isExchangeGoodForMarker(action) ||
            isExchangeMarkerForGood(action) ||
            isRaidCity(action) ||
            isRaidCog(action) ||
            isEndTurn(action)
        return isTurnAction && context.gameState.isTurnOf(action.playerId)
    }

    validActionsForPlayer(
        playerId: string,
        context: MachineContext<HydratedKoggeGameState>
    ): ActionType[] {
        const state = context.gameState
        if (!state.isTurnOf(playerId)) {
            return []
        }
        const available: [ActionType, boolean][] = [
            [ActionType.Sail, HydratedSail.canSail(state, playerId)],
            [ActionType.BuildOffice, HydratedBuildOffice.canBuildOffice(state, playerId)],
            [
                ActionType.BuyRouteMarkers,
                HydratedBuyRouteMarkers.canBuyRouteMarkers(state, playerId)
            ],
            [ActionType.TradeGoods, HydratedTradeGoods.canTradeGoods(state, playerId)],
            [ActionType.ChangeRoute, HydratedChangeRoute.canChangeRoute(state, playerId)],
            [
                ActionType.ClaimRaidMarker,
                HydratedClaimRaidMarker.canClaimRaidMarker(state, playerId)
            ],
            [ActionType.ClaimBonusChit, HydratedClaimBonusChit.canClaimBonusChit(state, playerId)],
            [
                ActionType.ExchangeGoodForMarker,
                HydratedExchangeGoodForMarker.canExchangeGoodForMarker(state, playerId)
            ],
            [
                ActionType.ExchangeMarkerForGood,
                HydratedExchangeMarkerForGood.canExchangeMarkerForGood(state, playerId)
            ],
            [ActionType.RaidCity, HydratedRaidCity.canRaidCity(state, playerId)],
            [ActionType.RaidCog, HydratedRaidCog.canRaidCog(state, playerId)],
            [ActionType.EndTurn, HydratedEndTurn.canEndTurn(state, playerId)]
        ]
        return available.filter(([, allowed]) => allowed).map(([type]) => type)
    }

    enter(context: MachineContext<HydratedKoggeGameState>) {
        const state = context.gameState
        if (state.turn) {
            return
        }
        const playerId = state.beginTurn()
        state.turnManager.startTurn(playerId, state.actionCount)
        state.activePlayerIds = [playerId]
    }

    onAction(
        action: TakingTurnAction,
        context: MachineContext<HydratedKoggeGameState>
    ): MachineState {
        const state = context.gameState
        switch (true) {
            case isBuildOffice(action):
            case isClaimBonusChit(action):
                return state.hasWon(action.playerId)
                    ? finishGameDuringTurn(state)
                    : MachineState.TakingTurn
            case isRaidCity(action):
                return MachineState.ExpellingRaider
            case isRaidCog(action):
                return state.getPlayerState(action.victimId).cargoCount() > 0
                    ? MachineState.DividingSpoils
                    : MachineState.ExpellingRaider
            case isEndTurn(action):
                return finishTurn(state)
            default:
                return MachineState.TakingTurn
        }
    }
}
