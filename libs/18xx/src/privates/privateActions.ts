import { defineAction, type ActionDefinition } from '../actions/actionDefinition.js'
import type { StockRules } from '../stock/stockRules.js'
import type { TrackRules } from '../construction/trackConstruction.js'
import type { TrainRules } from '../trains/trainPurchase.js'
import type { StationRules } from '../stations/stationPlacement.js'
import type { PrivatePowerRules } from './privatePowers.js'
import type { PrivateRules } from './privateRules.js'
import {
    ContinueOperatingRound,
    HydratedContinueOperatingRound,
    isContinueOperatingRound
} from './betweenCompaniesHandler.js'
import { BuyPrivateTrain, HydratedBuyPrivateTrain, isBuyPrivateTrain } from './buyPrivateTrain.js'
import {
    DeclinePrivateTile,
    HydratedDeclinePrivateTile,
    LayPrivateTile,
    HydratedLayPrivateTile,
    isDeclinePrivateTile,
    isLayPrivateTile,
    LayPrivateTileOutOfTurn,
    HydratedLayPrivateTileOutOfTurn,
    isLayPrivateTileOutOfTurn
} from './layPrivateTile.js'
import {
    DropPrivatePowerRequest,
    HydratedDropPrivatePowerRequest,
    HydratedSetPrivatePowerRequest,
    SetPrivatePowerRequest,
    isDropPrivatePowerRequest,
    isSetPrivatePowerRequest
} from './privatePowerRequest.js'
import {
    ExchangePrivate,
    ExchangePrivateOutOfTurn,
    HydratedExchangePrivate,
    HydratedExchangePrivateOutOfTurn,
    isExchangePrivate,
    isExchangePrivateOutOfTurn
} from './exchangePrivate.js'
import {
    DeclinePrivateStation,
    HydratedDeclinePrivateStation,
    HydratedPlacePrivateStation,
    PlacePrivateStation,
    isDeclinePrivateStation,
    isPlacePrivateStation
} from './privateStation.js'
import {
    HydratedPlacePrivateMarker,
    PlacePrivateMarker,
    isPlacePrivateMarker
} from './placePrivateMarker.js'

export function privateActions(rules: {
    privateRules: PrivateRules
    privatePowerRules: PrivatePowerRules
    stockRules: StockRules
    trackRules: TrackRules
    trainRules: TrainRules
    stationRules: StationRules
    outOfTurnPrivatePowers?: boolean
}): ActionDefinition[] {
    const layRules = {
        powers: rules.privatePowerRules,
        track: rules.trackRules,
        stations: rules.stationRules
    }
    const outOfTurnActions = rules.outOfTurnPrivatePowers
        ? [
              defineAction(
                  ExchangePrivateOutOfTurn,
                  isExchangePrivateOutOfTurn,
                  (action) =>
                      new HydratedExchangePrivateOutOfTurn(
                          action,
                          rules.privateRules,
                          rules.stockRules
                      )
              ),
              defineAction(
                  LayPrivateTileOutOfTurn,
                  isLayPrivateTileOutOfTurn,
                  (action) => new HydratedLayPrivateTileOutOfTurn(action, layRules)
              )
          ]
        : []
    const requestActions = rules.privatePowerRules.betweenTurnsPrivateIds?.length
        ? [
              defineAction(
                  SetPrivatePowerRequest,
                  isSetPrivatePowerRequest,
                  (action) => new HydratedSetPrivatePowerRequest(action, rules.privatePowerRules)
              ),
              defineAction(
                  DropPrivatePowerRequest,
                  isDropPrivatePowerRequest,
                  (action) => new HydratedDropPrivatePowerRequest(action)
              )
          ]
        : []
    const markerActions = rules.privatePowerRules.markerTerms
        ? [
              defineAction(
                  PlacePrivateMarker,
                  isPlacePrivateMarker,
                  (action) => new HydratedPlacePrivateMarker(action, rules.privatePowerRules)
              )
          ]
        : []
    const stationActions = rules.privatePowerRules.stationPrivateIds?.length
        ? [
              defineAction(
                  PlacePrivateStation,
                  isPlacePrivateStation,
                  (action) => new HydratedPlacePrivateStation(action, rules.stationRules)
              ),
              defineAction(
                  DeclinePrivateStation,
                  isDeclinePrivateStation,
                  (action) => new HydratedDeclinePrivateStation(action)
              )
          ]
        : []
    return [
        defineAction(
            ContinueOperatingRound,
            isContinueOperatingRound,
            (action) => new HydratedContinueOperatingRound(action)
        ),
        defineAction(
            BuyPrivateTrain,
            isBuyPrivateTrain,
            (action) =>
                new HydratedBuyPrivateTrain(action, rules.privatePowerRules, rules.trainRules)
        ),
        defineAction(
            DeclinePrivateTile,
            isDeclinePrivateTile,
            (action) => new HydratedDeclinePrivateTile(action)
        ),
        defineAction(
            LayPrivateTile,
            isLayPrivateTile,
            (action) => new HydratedLayPrivateTile(action, layRules)
        ),
        defineAction(
            ExchangePrivate,
            isExchangePrivate,
            (action) => new HydratedExchangePrivate(action, rules.privateRules, rules.stockRules)
        ),
        ...outOfTurnActions,
        ...requestActions,
        ...stationActions,
        ...markerActions
    ]
}
