import { defineGame, type GameDefinition } from '@tabletop/common'
import {
    createEighteenXXRuntime,
    defineAction,
    ProtectingPriceState,
    ConsentingRedemptionState,
    StepActionsHandler,
    clearsOnLeaving,
    closesAtZeroInPlace,
    type EighteenXXTitleRules
} from '@tabletop/18xx'
import {
    HydratedPlaceEdgeToken,
    PlaceEdgeToken,
    PlaceEdgeTokenStep,
    isPlaceEdgeToken
} from '../edgeTokens.js'
import { MesabiPurchase } from '../mesabi.js'
import { Names1850 } from '../names.js'
import { AuctionRules1850, createOpening1850, startingCash1850 } from '../opening.js'
import {
    CompanyRules1850,
    EarningsRules1850,
    EndingRules1850,
    PhaseRules1850,
    PrivatePowerRules1850,
    PrivateRules1850,
    TransferRules1850,
    ZeroPriceClosure1850
} from '../operating.js'
import { RouteRules1850 } from '../routes.js'
import {
    State1850,
    StateDefinition1850,
    type HydratedState1850,
    type StateHandler1850
} from '../state.js'
import { StationRules1850 } from '../stations.js'
import {
    OperatingRules1850,
    PriceProtection1850,
    ShareRedemption1850,
    StockRules1850,
    TrainFundingRules1850
} from '../stock.js'
import { TrackRules1850 } from '../track.js'
import { Phases1850, TrainRules1850 } from '../trains.js'
import { Info1850 } from './info.js'

// What the company did with its track step applies to this turn alone (§6.5.1, §15.2).
const endsTrackTurn = (handler: StateHandler1850): StateHandler1850 =>
    clearsOnLeaving(handler, 'LayingTrack', (state) => {
        delete state.mesabiBought
        delete state.privateLaysThisTurn
        delete state.bridgeLaid
    })

const endsStationTurn = (handler: StateHandler1850): StateHandler1850 =>
    clearsOnLeaving(handler, 'PlacingStation', (state) => {
        delete state.edgeTokenPlaced
    })

// A declined sale can close its company, and a closure leaves the state to go on as it was.
const closesAtZero = (handler: StateHandler1850): StateHandler1850 =>
    closesAtZeroInPlace(handler, ZeroPriceClosure1850)

export const TitleRules1850: EighteenXXTitleRules<typeof State1850, HydratedState1850> = {
    state: StateDefinition1850,
    endingRules: EndingRules1850,
    names: Names1850,
    auctionRules: AuctionRules1850,
    createOpening: createOpening1850,
    startingCash: startingCash1850,
    currencySymbol: '$',
    stockRules: StockRules1850,
    companyRules: CompanyRules1850,
    operatingRules: OperatingRules1850,
    trackRules: TrackRules1850,
    stationRules: StationRules1850,
    earningsRules: EarningsRules1850,
    routeRules: RouteRules1850,
    trainRules: TrainRules1850,
    runInstructions: true,
    phases: Phases1850,
    phaseRules: PhaseRules1850,
    trainFundingRules: TrainFundingRules1850,
    privateRules: PrivateRules1850,
    privatePowerRules: PrivatePowerRules1850,
    transferRules: TransferRules1850,
    zeroPriceClosure: ZeroPriceClosure1850,
    additionalConstructionActions: [MesabiPurchase.step.type],
    decisionHandlers: {
        // Once a seller finishes, presidents may protect the prices of what they sold (§5.9).
        StockRound: (family) =>
            PriceProtection1850.starts(ShareRedemption1850.redeemsAndReissues(family)),
        OperatingSet: (family) => PriceProtection1850.starts(family),
        BuyingTrains: (family) => closesAtZero(PriceProtection1850.starts(family)),
        Bankrupt: (family) => PriceProtection1850.starts(family),
        LayingTrack: (family) =>
            endsTrackTurn(new StepActionsHandler(family, [MesabiPurchase.step])),
        PlacingStation: (family) =>
            endsStationTurn(new StepActionsHandler(family, [PlaceEdgeTokenStep]))
    },
    titleStateHandlers: {
        [ProtectingPriceState]: closesAtZero(PriceProtection1850.handler()),
        [ConsentingRedemptionState]: ShareRedemption1850.consentHandler()
    },
    titleActions: [
        ...PriceProtection1850.actions(),
        ...ShareRedemption1850.actions(),
        MesabiPurchase.action,
        defineAction(
            PlaceEdgeToken,
            isPlaceEdgeToken,
            (action) => new HydratedPlaceEdgeToken(action)
        )
    ]
}

export const Definition: GameDefinition<State1850, HydratedState1850> = defineGame({
    info: Info1850,
    runtime: createEighteenXXRuntime(TitleRules1850)
})
