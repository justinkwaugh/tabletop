import { ActionType } from './actions.js'
import { BeginRound } from '../actions/beginRound.js'
import { BuildOffice } from '../actions/buildOffice.js'
import { BuyRouteMarkers } from '../actions/buyRouteMarkers.js'
import { ChangeRoute } from '../actions/changeRoute.js'
import { ChooseSpoils } from '../actions/chooseSpoils.js'
import { ChooseStartCity } from '../actions/chooseStartCity.js'
import { ClaimBonusChit } from '../actions/claimBonusChit.js'
import { ClaimRaidMarker } from '../actions/claimRaidMarker.js'
import { DivideSpoils } from '../actions/divideSpoils.js'
import { EndTurn } from '../actions/endTurn.js'
import { ExchangeGoodForMarker } from '../actions/exchangeGoodForMarker.js'
import { ExchangeMarkerForGood } from '../actions/exchangeMarkerForGood.js'
import { ExpelRaider } from '../actions/expelRaider.js'
import { MoveGuildMaster } from '../actions/moveGuildMaster.js'
import { PassBid } from '../actions/passBid.js'
import { PlaceBid } from '../actions/placeBid.js'
import { RaidCity } from '../actions/raidCity.js'
import { RaidCog } from '../actions/raidCog.js'
import { ResolveAuction } from '../actions/resolveAuction.js'
import { RevealStartCities } from '../actions/revealStartCities.js'
import { Sail } from '../actions/sail.js'
import { TradeGoods } from '../actions/tradeGoods.js'

export const KoggeApiActions = {
    [ActionType.ChooseStartCity]: ChooseStartCity,
    [ActionType.PlaceBid]: PlaceBid,
    [ActionType.PassBid]: PassBid,
    [ActionType.MoveGuildMaster]: MoveGuildMaster,
    [ActionType.Sail]: Sail,
    [ActionType.BuildOffice]: BuildOffice,
    [ActionType.BuyRouteMarkers]: BuyRouteMarkers,
    [ActionType.TradeGoods]: TradeGoods,
    [ActionType.ChangeRoute]: ChangeRoute,
    [ActionType.ClaimRaidMarker]: ClaimRaidMarker,
    [ActionType.ClaimBonusChit]: ClaimBonusChit,
    [ActionType.ExchangeGoodForMarker]: ExchangeGoodForMarker,
    [ActionType.ExchangeMarkerForGood]: ExchangeMarkerForGood,
    [ActionType.RaidCity]: RaidCity,
    [ActionType.RaidCog]: RaidCog,
    [ActionType.DivideSpoils]: DivideSpoils,
    [ActionType.ChooseSpoils]: ChooseSpoils,
    [ActionType.ExpelRaider]: ExpelRaider,
    [ActionType.EndTurn]: EndTurn
}

export const KoggeActionSchemas = {
    ...KoggeApiActions,
    [ActionType.RevealStartCities]: RevealStartCities,
    [ActionType.BeginRound]: BeginRound,
    [ActionType.ResolveAuction]: ResolveAuction
}
