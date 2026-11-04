import { defineGame, type GameDefinition } from '@tabletop/common'
import {
    createEighteenXXRuntime,
    defineAction,
    ProtectingPriceState,
    PlacingDestinationStationState,
    ConsentingRedemptionState,
    StepActionsHandler,
    ZeroPriceClosureHandler,
    type EighteenXXTitleRules
} from '@tabletop/18xx'
import { DestinationRuns1870 } from '../destinations.js'
import { Names1870 } from '../names.js'
import { AuctionRules1870, createOpening1870, startingCash1870 } from '../opening.js'
import {
    CompanyRules1870,
    EarningsRules1870,
    EndingRules1870,
    PhaseRules1870,
    PrivatePowerRules1870,
    PrivateRules1870,
    TrainFundingRules1870,
    TransferRules1870,
    ZeroPriceClosure1870
} from '../operating.js'
import { RouteRules1870 } from '../routes.js'
import {
    State1870,
    StateDefinition1870,
    requireState1870,
    type HydratedState1870,
    type StateHandler1870
} from '../state.js'
import { StationRules1870 } from '../stations.js'
import {
    OperatingRules1870,
    PriceProtection1870,
    ShareRedemption1870,
    StockRules1870
} from '../stock.js'
import {
    HydratedPlaceRevenueToken,
    PlaceRevenueToken,
    PlaceRevenueTokenStep,
    isPlaceRevenueToken
} from '../tokens.js'
import { TrackRules1870 } from '../track.js'
import { Phases1870, TrainRules1870 } from '../trains.js'
import { Info1870 } from './info.js'

const withTokens = (family: StateHandler1870): StateHandler1870 =>
    new StepActionsHandler(family, [PlaceRevenueTokenStep])

// The bridge's tile is free to upgrade once its company's track step is over (p. 9).
const endsBridgeLay = (handler: StateHandler1870): StateHandler1870 => ({
    isValidAction: (action, context) => handler.isValidAction(action, context),
    validActionsForPlayer: (playerId, context) => handler.validActionsForPlayer(playerId, context),
    enter: (context) => handler.enter(context),
    onAction(action, context) {
        const next = handler.onAction(action, context)
        if (next !== 'LayingTrack') delete context.gameState.bridgeLayLocationId
        return next
    }
})

// A declined sale can close its company, and a closure leaves the state to go on as it was.
const closesAtZero = (handler: StateHandler1870): StateHandler1870 =>
    new ZeroPriceClosureHandler(
        handler,
        ZeroPriceClosure1870,
        (state, next) => next ?? state.machineState
    )

export const TitleRules1870: EighteenXXTitleRules<typeof State1870, HydratedState1870> = {
    state: StateDefinition1870,
    endingRules: EndingRules1870,
    names: Names1870,
    auctionRules: AuctionRules1870,
    createOpening: createOpening1870,
    startingCash: startingCash1870,
    currencySymbol: '$',
    stockRules: StockRules1870,
    companyRules: CompanyRules1870,
    operatingRules: OperatingRules1870,
    trackRules: TrackRules1870,
    stationRules: StationRules1870,
    earningsRules: EarningsRules1870,
    routeRules: RouteRules1870,
    trainRules: TrainRules1870,
    runInstructions: true,
    runInstructionsHeld: (state) => !!requireState1870(state).destinationRun,
    phases: Phases1870,
    phaseRules: PhaseRules1870,
    trainFundingRules: TrainFundingRules1870,
    privateRules: PrivateRules1870,
    privatePowerRules: PrivatePowerRules1870,
    transferRules: TransferRules1870,
    zeroPriceClosure: ZeroPriceClosure1870,
    additionalConstructionActions: ['PlaceRevenueToken'],
    decisionHandlers: {
        // Once a seller finishes, presidents may protect the prices of what they sold (p. 13).
        StockRound: (family) =>
            PriceProtection1870.starts(ShareRedemption1870.redeemsAndReissues(family)),
        OperatingSet: (family) => DestinationRuns1870.starts(PriceProtection1870.starts(family)),
        BuyingTrains: (family) => closesAtZero(PriceProtection1870.starts(withTokens(family))),
        Bankrupt: (family) => PriceProtection1870.starts(family),
        LayingTrack: (family) => endsBridgeLay(withTokens(family)),
        PlacingStation: withTokens,
        RunningTrains: withTokens,
        DistributingEarnings: (family) => DestinationRuns1870.endsAfterEarnings(family)
    },
    titleStateHandlers: {
        [ProtectingPriceState]: closesAtZero(PriceProtection1870.handler()),
        [ConsentingRedemptionState]: ShareRedemption1870.consentHandler(),
        [PlacingDestinationStationState]: DestinationRuns1870.handler()
    },
    titleActions: [
        ...PriceProtection1870.actions(),
        ...ShareRedemption1870.actions(),
        ...DestinationRuns1870.actions(),
        defineAction(
            PlaceRevenueToken,
            isPlaceRevenueToken,
            (action) => new HydratedPlaceRevenueToken(action)
        )
    ]
}

export const Definition: GameDefinition<State1870, HydratedState1870> = defineGame({
    info: Info1870,
    runtime: createEighteenXXRuntime(TitleRules1870)
})
