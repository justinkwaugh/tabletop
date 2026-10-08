import { type GameDefinition } from '@tabletop/common'
import { createEighteenXXRuntime, defineAction, type EighteenXXTitleRules } from '@tabletop/18xx'
import {
    CapitalizeCompany,
    HydratedCapitalizeCompany,
    capitalizesFloatedCompanies,
    isCapitalizeCompany
} from '../capitalization.js'
import { EighteenThirtyTwoCompanyRules } from '../companyRules.js'
import { EighteenThirtyTwoEarningsRules } from '../earningsRules.js'
import { EighteenThirtyTwoEndingRules } from '../endingRules.js'
import { EighteenThirtyTwoAuctionRules, createEighteenThirtyTwoOpening } from '../openingAuction.js'
import { EighteenThirtyTwoPhaseRules } from '../phaseRules.js'
import { EighteenThirtyTwoPrivatePowerRules } from '../privatePowerRules.js'
import { EighteenThirtyTwoPrivateRules } from '../privateRules.js'
import { EighteenThirtyTwoOperatingRules } from '../roundRules.js'
import { EighteenThirtyTwoRouteRules } from '../routeRules.js'
import {
    EighteenThirtyTwoState,
    EighteenThirtyTwoStateDefinition,
    type HydratedEighteenThirtyTwoState
} from '../state.js'
import { EighteenThirtyTwoStationRules } from '../stationRules.js'
import { EighteenThirtyTwoStockRules } from '../stockRules.js'
import { EighteenThirtyTwoTrackRules } from '../trackRules.js'
import { EighteenThirtyTwoTrainFundingRules } from '../trainFundingRules.js'
import { EighteenThirtyTwoPhases, EighteenThirtyTwoTrainRules } from '../trains.js'
import { EighteenThirtyTwoTransferRules } from '../transferRules.js'
import { EighteenThirtyTwoInfo } from './info.js'
import {
    BuyCoalRights,
    BuyCoalRightsStep,
    HydratedBuyCoalRights,
    isBuyCoalRights
} from '../coalFields.js'
import {
    HydratedTakeLondonShare,
    TakeLondonShare,
    TakeLondonShareStep,
    isTakeLondonShare
} from '../londonInvestment.js'
import {
    HydratedPlaceRevenueToken,
    HydratedRecordMiamiRun,
    PlaceRevenueToken,
    PlaceRevenueTokenStep,
    RecordMiamiRun,
    isPlaceRevenueToken,
    isRecordMiamiRun,
    recordsMiamiRun
} from '../revenueTokens.js'
import { TitleActionsHandler } from '../titleActions.js'
import { CloseCompany, HydratedCloseCompany, closesCompanies, isCloseCompany } from '../closure.js'
import {
    CompletePriceProtection,
    DeclineProtection,
    HydratedCompletePriceProtection,
    HydratedDeclineProtection,
    HydratedProtectShares,
    HydratedStartPriceProtection,
    ProtectShares,
    ProtectingPriceHandler,
    StartPriceProtection,
    isCompletePriceProtection,
    isDeclineProtection,
    isProtectShares,
    isStartPriceProtection,
    startsPriceProtection
} from '../priceProtection.js'
import type { EighteenThirtyTwoStateHandler } from '../state.js'
import {
    AnswerMerger,
    CompleteMergerPhase,
    CompleteTakeover,
    DiscardMergedTrain,
    HydratedAnswerMerger,
    HydratedCompleteMergerPhase,
    HydratedCompleteTakeover,
    HydratedDiscardMergedTrain,
    HydratedPassMerger,
    HydratedProposeMerger,
    HydratedSellTakeoverShares,
    HydratedStartMergerPhase,
    MergingHandler,
    PassMerger,
    ProposeMerger,
    SellTakeoverShares,
    StartMergerPhase,
    isAnswerMerger,
    isCompleteMergerPhase,
    isCompleteTakeover,
    isDiscardMergedTrain,
    isPassMerger,
    isProposeMerger,
    isSellTakeoverShares,
    isStartMergerPhase,
    startsMergerPhase
} from '../mergers.js'
import {
    AnswerRedemption,
    ConsentingRedemptionHandler,
    HydratedAnswerRedemption,
    HydratedRedeemShare,
    HydratedReissueShares,
    RedeemShare,
    ReissueShares,
    redeemsAndReissues,
    isAnswerRedemption,
    isRedeemShare,
    isReissueShares
} from '../redemption.js'

// A company closes as its price enters the black area; once a seller finishes, the presidents
// of the companies sold may protect their prices (§5.1.1, §5.9).
const closesAndProtects = (handler: EighteenThirtyTwoStateHandler) =>
    closesCompanies(startsPriceProtection(handler))

export const EighteenThirtyTwoTitleRules: EighteenXXTitleRules<
    typeof EighteenThirtyTwoState,
    HydratedEighteenThirtyTwoState
> = {
    state: EighteenThirtyTwoStateDefinition,
    endingRules: EighteenThirtyTwoEndingRules,
    auctionRules: EighteenThirtyTwoAuctionRules,
    trainFundingRules: EighteenThirtyTwoTrainFundingRules,
    transferRules: EighteenThirtyTwoTransferRules,
    privatePowerRules: EighteenThirtyTwoPrivatePowerRules,
    createOpening: createEighteenThirtyTwoOpening,
    stockRules: EighteenThirtyTwoStockRules,
    companyRules: EighteenThirtyTwoCompanyRules,
    operatingRules: EighteenThirtyTwoOperatingRules,
    trackRules: EighteenThirtyTwoTrackRules,
    stationRules: EighteenThirtyTwoStationRules,
    earningsRules: EighteenThirtyTwoEarningsRules,
    routeRules: EighteenThirtyTwoRouteRules,
    privateRules: EighteenThirtyTwoPrivateRules,
    phases: EighteenThirtyTwoPhases,
    phaseRules: EighteenThirtyTwoPhaseRules,
    trainRules: EighteenThirtyTwoTrainRules,
    additionalConstructionActions: ['BuyCoalRights'],
    decisionHandlers: {
        StockRound: (family) =>
            closesAndProtects(
                redeemsAndReissues(new TitleActionsHandler(family, [TakeLondonShareStep]))
            ),
        StartingOperatingSet: (family) =>
            capitalizesFloatedCompanies(startsMergerPhase(family, false)),
        OperatingSet: (family) => closesAndProtects(startsMergerPhase(family, true)),
        FundingTrain: closesCompanies,
        BuyingTrains: closesAndProtects,
        LayingTrack: (family) => new TitleActionsHandler(family, [BuyCoalRightsStep]),
        PlacingStation: (family) => new TitleActionsHandler(family, [PlaceRevenueTokenStep]),
        DistributingEarnings: recordsMiamiRun
    },
    titleStateHandlers: {
        ProtectingPrice: closesCompanies(new ProtectingPriceHandler()),
        ConsentingRedemption: new ConsentingRedemptionHandler(),
        Merging: closesAndProtects(new MergingHandler())
    },
    titleActions: [
        defineAction(CloseCompany, isCloseCompany, (action) => new HydratedCloseCompany(action)),
        defineAction(RedeemShare, isRedeemShare, (action) => new HydratedRedeemShare(action)),
        defineAction(
            StartMergerPhase,
            isStartMergerPhase,
            (action) => new HydratedStartMergerPhase(action)
        ),
        defineAction(ProposeMerger, isProposeMerger, (action) => new HydratedProposeMerger(action)),
        defineAction(AnswerMerger, isAnswerMerger, (action) => new HydratedAnswerMerger(action)),
        defineAction(PassMerger, isPassMerger, (action) => new HydratedPassMerger(action)),
        defineAction(
            SellTakeoverShares,
            isSellTakeoverShares,
            (action) => new HydratedSellTakeoverShares(action)
        ),
        defineAction(
            CompleteTakeover,
            isCompleteTakeover,
            (action) => new HydratedCompleteTakeover(action)
        ),
        defineAction(
            DiscardMergedTrain,
            isDiscardMergedTrain,
            (action) => new HydratedDiscardMergedTrain(action)
        ),
        defineAction(
            CompleteMergerPhase,
            isCompleteMergerPhase,
            (action) => new HydratedCompleteMergerPhase(action)
        ),
        defineAction(
            AnswerRedemption,
            isAnswerRedemption,
            (action) => new HydratedAnswerRedemption(action)
        ),
        defineAction(ReissueShares, isReissueShares, (action) => new HydratedReissueShares(action)),
        defineAction(
            StartPriceProtection,
            isStartPriceProtection,
            (action) => new HydratedStartPriceProtection(action)
        ),
        defineAction(ProtectShares, isProtectShares, (action) => new HydratedProtectShares(action)),
        defineAction(
            DeclineProtection,
            isDeclineProtection,
            (action) => new HydratedDeclineProtection(action)
        ),
        defineAction(
            CompletePriceProtection,
            isCompletePriceProtection,
            (action) => new HydratedCompletePriceProtection(action)
        ),
        defineAction(
            CapitalizeCompany,
            isCapitalizeCompany,
            (action) => new HydratedCapitalizeCompany(action)
        ),
        defineAction(BuyCoalRights, isBuyCoalRights, (action) => new HydratedBuyCoalRights(action)),
        defineAction(
            PlaceRevenueToken,
            isPlaceRevenueToken,
            (action) => new HydratedPlaceRevenueToken(action)
        ),
        defineAction(
            RecordMiamiRun,
            isRecordMiamiRun,
            (action) => new HydratedRecordMiamiRun(action)
        ),
        defineAction(
            TakeLondonShare,
            isTakeLondonShare,
            (action) => new HydratedTakeLondonShare(action)
        )
    ]
}

export const Definition: GameDefinition<EighteenThirtyTwoState, HydratedEighteenThirtyTwoState> = {
    info: EighteenThirtyTwoInfo,
    runtime: createEighteenXXRuntime(EighteenThirtyTwoTitleRules)
}
