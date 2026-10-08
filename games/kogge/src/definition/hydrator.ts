import type { GameAction, GameHydrator, HydratedAction } from '@tabletop/common'
import { HydratedKoggeGameState, type KoggeProjectedState } from '../model/gameState.js'
import { HydratedChooseStartCity, isChooseStartCity } from '../actions/chooseStartCity.js'
import { HydratedRevealStartCities, isRevealStartCities } from '../actions/revealStartCities.js'
import { HydratedBeginRound, isBeginRound } from '../actions/beginRound.js'
import { HydratedPlaceBid, isPlaceBid } from '../actions/placeBid.js'
import { HydratedPassBid, isPassBid } from '../actions/passBid.js'
import { HydratedResolveAuction, isResolveAuction } from '../actions/resolveAuction.js'
import { HydratedMoveGuildMaster, isMoveGuildMaster } from '../actions/moveGuildMaster.js'
import { HydratedSail, isSail } from '../actions/sail.js'
import { HydratedBuildOffice, isBuildOffice } from '../actions/buildOffice.js'
import { HydratedBuyRouteMarkers, isBuyRouteMarkers } from '../actions/buyRouteMarkers.js'
import { HydratedTradeGoods, isTradeGoods } from '../actions/tradeGoods.js'
import { HydratedChangeRoute, isChangeRoute } from '../actions/changeRoute.js'
import { HydratedClaimRaidMarker, isClaimRaidMarker } from '../actions/claimRaidMarker.js'
import { HydratedClaimBonusChit, isClaimBonusChit } from '../actions/claimBonusChit.js'
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
import { HydratedDivideSpoils, isDivideSpoils } from '../actions/divideSpoils.js'
import { HydratedChooseSpoils, isChooseSpoils } from '../actions/chooseSpoils.js'
import { HydratedExpelRaider, isExpelRaider } from '../actions/expelRaider.js'
import { HydratedEndTurn, isEndTurn } from '../actions/endTurn.js'

export class KoggeHydrator implements GameHydrator<KoggeProjectedState, HydratedKoggeGameState> {
    hydrateAction(data: GameAction): HydratedAction {
        switch (true) {
            case isChooseStartCity(data):
                return new HydratedChooseStartCity(data)
            case isRevealStartCities(data):
                return new HydratedRevealStartCities(data)
            case isBeginRound(data):
                return new HydratedBeginRound(data)
            case isPlaceBid(data):
                return new HydratedPlaceBid(data)
            case isPassBid(data):
                return new HydratedPassBid(data)
            case isResolveAuction(data):
                return new HydratedResolveAuction(data)
            case isMoveGuildMaster(data):
                return new HydratedMoveGuildMaster(data)
            case isSail(data):
                return new HydratedSail(data)
            case isBuildOffice(data):
                return new HydratedBuildOffice(data)
            case isBuyRouteMarkers(data):
                return new HydratedBuyRouteMarkers(data)
            case isTradeGoods(data):
                return new HydratedTradeGoods(data)
            case isChangeRoute(data):
                return new HydratedChangeRoute(data)
            case isClaimRaidMarker(data):
                return new HydratedClaimRaidMarker(data)
            case isClaimBonusChit(data):
                return new HydratedClaimBonusChit(data)
            case isExchangeGoodForMarker(data):
                return new HydratedExchangeGoodForMarker(data)
            case isExchangeMarkerForGood(data):
                return new HydratedExchangeMarkerForGood(data)
            case isRaidCity(data):
                return new HydratedRaidCity(data)
            case isRaidCog(data):
                return new HydratedRaidCog(data)
            case isDivideSpoils(data):
                return new HydratedDivideSpoils(data)
            case isChooseSpoils(data):
                return new HydratedChooseSpoils(data)
            case isExpelRaider(data):
                return new HydratedExpelRaider(data)
            case isEndTurn(data):
                return new HydratedEndTurn(data)
            default:
                throw new Error(`Unknown action type ${data.type}`)
        }
    }

    hydrateState(state: KoggeProjectedState): HydratedKoggeGameState {
        return new HydratedKoggeGameState(state)
    }
}
