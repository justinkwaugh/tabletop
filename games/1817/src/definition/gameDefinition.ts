import { type GameDefinition } from '@tabletop/common'
import {
    createEighteenXXRuntime,
    defineAction,
    type EighteenXXState,
    type EighteenXXTitleRules,
    type HydratedEighteenXXState
} from '@tabletop/18xx'
import { EighteenSeventeenEndingRules } from '../endingRules.js'
import { EighteenSeventeenAuctionRules, createEighteenSeventeenOpening } from '../openingAuction.js'
import { EighteenSeventeenTrainFundingRules } from '../trainFundingRules.js'
import { EighteenSeventeenTransferRules } from '../transferRules.js'
import { EighteenSeventeenPrivatePowerRules } from '../privatePowerRules.js'
import { EighteenSeventeenPrivateRules } from '../privateRules.js'
import { EighteenSeventeenPhaseRules } from '../phaseRules.js'
import { EighteenSeventeenEarningsRules } from '../earningsRules.js'
import { EighteenSeventeenRouteRules } from '../routeRules.js'
import { EighteenSeventeenPhases, EighteenSeventeenTrainRules } from '../trains.js'
import { EighteenSeventeenStationRules } from '../stationRules.js'
import { EighteenSeventeenTrackRules } from '../trackRules.js'
import { EighteenSeventeenOperatingRules } from '../roundRules.js'
import { EighteenSeventeenCompanyRules } from '../companyRules.js'
import { EighteenSeventeenStockRules } from '../stockRules.js'
import { EighteenSeventeenInfo } from './info.js'
import { EighteenSeventeenStateDefinition } from '../state.js'
import { EighteenSeventeenLoanRules } from '../loanRules.js'
import { EighteenSeventeenCashCrisisRules } from '../bankruptcy.js'
import {
    BorrowingAfterConversionHandler,
    BuyConvertedShare,
    ConvertCompany,
    EndMergerRound,
    FinishConversionLoans,
    HydratedBuyConvertedShare,
    HydratedConvertCompany,
    HydratedEndMergerRound,
    HydratedFinishConversionLoans,
    HydratedMergeCompanies,
    HydratedPassConvertedShares,
    HydratedPassMerger,
    HydratedStartMergerRound,
    MergeCompanies,
    MergerRoundHandler,
    PassConvertedShares,
    PassMerger,
    StartMergerRound,
    TradingConvertedSharesHandler,
    isBuyConvertedShare,
    isConvertCompany,
    isEndMergerRound,
    isFinishConversionLoans,
    isMergeCompanies,
    isPassConvertedShares,
    isPassMerger,
    isStartMergerRound,
    startsMergerRounds
} from '../mergerRound.js'
import {
    CompanyExcessHandler,
    DiscardMergedTrain,
    HydratedDiscardMergedTrain,
    HydratedRemoveStation,
    RemoveStation,
    isDiscardMergedTrain,
    isRemoveStation
} from '../companyExcess.js'
import {
    AcquireCompany,
    AcquisitionBiddingHandler,
    AcquisitionLoansHandler,
    AcquisitionRoundHandler,
    BidToAcquire,
    ChoosingAcquirerHandler,
    CloseCompanySale,
    DeclineOffer,
    EndAcquisitionRound,
    FinishAcquisitionLoans,
    HydratedAcquireCompany,
    HydratedBidToAcquire,
    HydratedCloseCompanySale,
    HydratedDeclineOffer,
    HydratedEndAcquisitionRound,
    HydratedFinishAcquisitionLoans,
    HydratedOfferCompany,
    HydratedOpenCompanySale,
    HydratedPassOnCompany,
    HydratedRepayAcquiredLoan,
    HydratedSkipCompanySale,
    HydratedStartAcquisitionRound,
    OfferCompany,
    OpenCompanySale,
    PassOnCompany,
    RepayAcquiredLoan,
    SkipCompanySale,
    StartAcquisitionRound,
    isAcquireCompany,
    isBidToAcquire,
    isCloseCompanySale,
    isDeclineOffer,
    isEndAcquisitionRound,
    isFinishAcquisitionLoans,
    isOfferCompany,
    isOpenCompanySale,
    isPassOnCompany,
    isRepayAcquiredLoan,
    isSkipCompanySale,
    isStartAcquisitionRound,
    startsAcquisitionRounds
} from '../acquisitionRound.js'
import {
    CloseMarketShorts,
    HydratedCloseMarketShorts,
    HydratedShortShare,
    ShortSellingHandler,
    ShortShare,
    buysOutMarketShorts,
    isCloseMarketShorts,
    isShortShare
} from '../shorts.js'
import {
    BuyBackShares,
    CorporateActionsHandler,
    HydratedBuyBackShares,
    isBuyBackShares
} from '../corporateActions.js'
import {
    BuyOwedStations,
    HydratedBuyOwedStations,
    buysOwedStations,
    liquidatesUnpaidStations,
    isBuyOwedStations
} from '../owedStations.js'
import {
    HydratedLiquidateCompany,
    LiquidateCompany,
    liquidatesTrainlessCompanies,
    isLiquidateCompany
} from '../liquidation.js'

export const EighteenSeventeenTitleRules: EighteenXXTitleRules = {
    state: EighteenSeventeenStateDefinition,
    endingRules: EighteenSeventeenEndingRules,
    selectionAuctionRules: EighteenSeventeenAuctionRules,
    trainFundingRules: EighteenSeventeenTrainFundingRules,
    transferRules: EighteenSeventeenTransferRules,
    privatePowerRules: EighteenSeventeenPrivatePowerRules,
    createOpening: createEighteenSeventeenOpening,
    stockRules: EighteenSeventeenStockRules,
    companyRules: EighteenSeventeenCompanyRules,
    operatingRules: EighteenSeventeenOperatingRules,
    trackRules: EighteenSeventeenTrackRules,
    stationRules: EighteenSeventeenStationRules,
    earningsRules: EighteenSeventeenEarningsRules,
    routeRules: EighteenSeventeenRouteRules,
    privateRules: EighteenSeventeenPrivateRules,
    phases: EighteenSeventeenPhases,
    phaseRules: EighteenSeventeenPhaseRules,
    trainRules: EighteenSeventeenTrainRules,
    loanRules: EighteenSeventeenLoanRules,
    cashCrisisRules: EighteenSeventeenCashCrisisRules,
    decisionHandlers: {
        StockRound: (family) =>
            buysOwedStations(new ShortSellingHandler(new CorporateActionsHandler(family))),
        StartingOperatingSet: (family) => buysOwedStations(liquidatesUnpaidStations(family)),
        OperatingSet: (family) =>
            liquidatesTrainlessCompanies(
                startsMergerRounds(startsAcquisitionRounds(buysOutMarketShorts(family)))
            )
    },
    titleStateHandlers: {
        MergerRound: new MergerRoundHandler(),
        TradingConvertedShares: new TradingConvertedSharesHandler(),
        BorrowingAfterConversion: new BorrowingAfterConversionHandler(),
        ReducingStations: new CompanyExcessHandler(),
        DiscardingMergedTrains: new CompanyExcessHandler(),
        AcquisitionRound: new AcquisitionRoundHandler(),
        AcquisitionBidding: new AcquisitionBiddingHandler(),
        ChoosingAcquirer: new ChoosingAcquirerHandler(),
        AcquisitionLoans: new AcquisitionLoansHandler()
    },
    titleActions: [
        defineAction(
            StartMergerRound,
            isStartMergerRound,
            (action) => new HydratedStartMergerRound(action)
        ),
        defineAction(
            EndMergerRound,
            isEndMergerRound,
            (action) => new HydratedEndMergerRound(action)
        ),
        defineAction(
            ConvertCompany,
            isConvertCompany,
            (action) => new HydratedConvertCompany(action)
        ),
        defineAction(
            MergeCompanies,
            isMergeCompanies,
            (action) => new HydratedMergeCompanies(action)
        ),
        defineAction(PassMerger, isPassMerger, (action) => new HydratedPassMerger(action)),
        defineAction(
            BuyConvertedShare,
            isBuyConvertedShare,
            (action) => new HydratedBuyConvertedShare(action)
        ),
        defineAction(
            PassConvertedShares,
            isPassConvertedShares,
            (action) => new HydratedPassConvertedShares(action)
        ),
        defineAction(
            FinishConversionLoans,
            isFinishConversionLoans,
            (action) => new HydratedFinishConversionLoans(action)
        ),
        defineAction(RemoveStation, isRemoveStation, (action) => new HydratedRemoveStation(action)),
        defineAction(
            DiscardMergedTrain,
            isDiscardMergedTrain,
            (action) => new HydratedDiscardMergedTrain(action)
        ),
        defineAction(
            StartAcquisitionRound,
            isStartAcquisitionRound,
            (action) => new HydratedStartAcquisitionRound(action)
        ),
        defineAction(
            EndAcquisitionRound,
            isEndAcquisitionRound,
            (action) => new HydratedEndAcquisitionRound(action)
        ),
        defineAction(
            SkipCompanySale,
            isSkipCompanySale,
            (action) => new HydratedSkipCompanySale(action)
        ),
        defineAction(
            OpenCompanySale,
            isOpenCompanySale,
            (action) => new HydratedOpenCompanySale(action)
        ),
        defineAction(OfferCompany, isOfferCompany, (action) => new HydratedOfferCompany(action)),
        defineAction(DeclineOffer, isDeclineOffer, (action) => new HydratedDeclineOffer(action)),
        defineAction(BidToAcquire, isBidToAcquire, (action) => new HydratedBidToAcquire(action)),
        defineAction(PassOnCompany, isPassOnCompany, (action) => new HydratedPassOnCompany(action)),
        defineAction(
            CloseCompanySale,
            isCloseCompanySale,
            (action) => new HydratedCloseCompanySale(action)
        ),
        defineAction(
            AcquireCompany,
            isAcquireCompany,
            (action) => new HydratedAcquireCompany(action)
        ),
        defineAction(
            RepayAcquiredLoan,
            isRepayAcquiredLoan,
            (action) => new HydratedRepayAcquiredLoan(action)
        ),
        defineAction(
            FinishAcquisitionLoans,
            isFinishAcquisitionLoans,
            (action) => new HydratedFinishAcquisitionLoans(action)
        ),
        defineAction(ShortShare, isShortShare, (action) => new HydratedShortShare(action)),
        defineAction(
            CloseMarketShorts,
            isCloseMarketShorts,
            (action) => new HydratedCloseMarketShorts(action)
        ),
        defineAction(BuyBackShares, isBuyBackShares, (action) => new HydratedBuyBackShares(action)),
        defineAction(
            BuyOwedStations,
            isBuyOwedStations,
            (action) => new HydratedBuyOwedStations(action)
        ),
        defineAction(
            LiquidateCompany,
            isLiquidateCompany,
            (action) => new HydratedLiquidateCompany(action)
        )
    ]
}

export const Definition: GameDefinition<EighteenXXState, HydratedEighteenXXState> = {
    info: EighteenSeventeenInfo,
    runtime: createEighteenXXRuntime(EighteenSeventeenTitleRules)
}
