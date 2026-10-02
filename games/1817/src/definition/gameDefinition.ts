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
    DiscardMergedTrain,
    EndMergerRound,
    FinishConversionLoans,
    HydratedBuyConvertedShare,
    HydratedConvertCompany,
    HydratedDiscardMergedTrain,
    HydratedEndMergerRound,
    HydratedFinishConversionLoans,
    HydratedMergeCompanies,
    HydratedPassConvertedShares,
    HydratedPassMerger,
    HydratedRemoveStation,
    HydratedStartMergerRound,
    MergeCompanies,
    MergerExcessHandler,
    MergerRoundHandler,
    MergerRoundStartHandler,
    PassConvertedShares,
    PassMerger,
    RemoveStation,
    StartMergerRound,
    TradingConvertedSharesHandler,
    isBuyConvertedShare,
    isConvertCompany,
    isDiscardMergedTrain,
    isEndMergerRound,
    isFinishConversionLoans,
    isMergeCompanies,
    isPassConvertedShares,
    isPassMerger,
    isRemoveStation,
    isStartMergerRound
} from '../mergerRound.js'
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
            liquidatesTrainlessCompanies(new MergerRoundStartHandler(buysOutMarketShorts(family)))
    },
    titleStateHandlers: {
        MergerRound: new MergerRoundHandler(),
        TradingConvertedShares: new TradingConvertedSharesHandler(),
        BorrowingAfterConversion: new BorrowingAfterConversionHandler(),
        ReducingStations: new MergerExcessHandler(),
        DiscardingMergedTrains: new MergerExcessHandler()
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
