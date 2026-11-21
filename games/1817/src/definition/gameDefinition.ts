import { EighteenSeventeenNames } from '../names.js'
import type { GameDefinition } from '@tabletop/common'
import { createEighteenXXRuntime, defineAction, type EighteenXXTitleRules } from '@tabletop/18xx'
import { EighteenSeventeenEndingRules } from '../endingRules.js'
import {
    EighteenSeventeenAuctionRules,
    createEighteenSeventeenOpening,
    eighteenSeventeenStartingCash
} from '../openingAuction.js'
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
import {
    EighteenSeventeenStateDefinition,
    EighteenSeventeenState,
    type HydratedEighteenSeventeenState
} from '../state.js'
import { EighteenSeventeenLoanRules } from '../loanRules.js'
import { EighteenSeventeenCashCrisisRules } from '../bankruptcy.js'
import {
    CloseTrainStation,
    EighteenSeventeenStations,
    HydratedCloseTrainStation,
    closesTrainStation,
    isCloseTrainStation
} from '../owedStations.js'
import {
    EighteenSeventeenAcquisitionRounds,
    EighteenSeventeenBuyBacks,
    EighteenSeventeenCompanyExcess,
    EighteenSeventeenConversionRounds,
    EighteenSeventeenLiquidations,
    EighteenSeventeenShortSelling
} from '../companyRounds.js'

export const EighteenSeventeenTitleRules: EighteenXXTitleRules<
    typeof EighteenSeventeenState,
    HydratedEighteenSeventeenState
> = {
    state: EighteenSeventeenStateDefinition,
    endingRules: EighteenSeventeenEndingRules,
    names: EighteenSeventeenNames,
    selectionAuctionRules: EighteenSeventeenAuctionRules,
    trainFundingRules: EighteenSeventeenTrainFundingRules,
    transferRules: EighteenSeventeenTransferRules,
    privatePowerRules: EighteenSeventeenPrivatePowerRules,
    createOpening: createEighteenSeventeenOpening,
    startingCash: eighteenSeventeenStartingCash,
    currencySymbol: '$',
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
    runInstructions: true,
    loanRules: EighteenSeventeenLoanRules,
    cashCrisisRules: EighteenSeventeenCashCrisisRules,
    decisionHandlers: {
        StockRound: (family) =>
            EighteenSeventeenStations.buysOwedStations(
                EighteenSeventeenShortSelling.shortsInStockRound(
                    EighteenSeventeenBuyBacks.corporateActionsHandler(family)
                )
            ),
        StartingOperatingSet: (family) =>
            EighteenSeventeenStations.buysOwedStations(
                EighteenSeventeenStations.liquidatesUnpaidStations(closesTrainStation(family))
            ),
        OperatingSet: (family) =>
            EighteenSeventeenLiquidations.liquidatesTrainlessCompanies(
                EighteenSeventeenConversionRounds.starts(
                    EighteenSeventeenAcquisitionRounds.starts(
                        EighteenSeventeenShortSelling.buysOutMarketShorts(family)
                    )
                )
            )
    },
    titleStateHandlers: {
        ...EighteenSeventeenConversionRounds.stateHandlers('OperatingSet'),
        ...EighteenSeventeenCompanyExcess.stateHandlers(),
        ...EighteenSeventeenAcquisitionRounds.stateHandlers('OperatingSet')
    },
    titleActions: [
        ...EighteenSeventeenConversionRounds.actions(),
        ...EighteenSeventeenCompanyExcess.actions(),
        ...EighteenSeventeenAcquisitionRounds.actions(),
        defineAction(
            CloseTrainStation,
            isCloseTrainStation,
            (action) => new HydratedCloseTrainStation(action)
        ),
        ...EighteenSeventeenShortSelling.actions(),
        ...EighteenSeventeenBuyBacks.actions(),
        ...EighteenSeventeenStations.actions(),
        ...EighteenSeventeenLiquidations.actions()
    ]
}

export const Definition: GameDefinition<EighteenSeventeenState, HydratedEighteenSeventeenState> = {
    info: EighteenSeventeenInfo,
    runtime: createEighteenXXRuntime(EighteenSeventeenTitleRules)
}
