import { TheOldPrinceEndingRules } from './endingRules.js'
import { TheOldPrinceStockRoundHandler } from './stockRoundHandler.js'
import { SplitCompany, HydratedSplitCompany, isSplitCompany } from './splitCompany.js'
import { TheOldPrinceAuctionRules, createTheOldPrinceOpening } from './openingAuction.js'
import { TheOldPrinceTrainFundingRules } from './trainFundingRules.js'
import { TheOldPrinceTransferRules } from './transferRules.js'
import { TheOldPrincePrivatePowerRules } from './privatePowerRules.js'
import { TheOldPrincePrivateRules } from './privateRules.js'
import { TheOldPrincePhaseRules } from './phaseRules.js'
import { TheOldPrinceEarningsRules } from './earningsRules.js'
import { TheOldPrinceRouteRules } from './routeRules.js'
import { TheOldPrincePhases, TheOldPrinceTrainRules } from './trains.js'
import { TheOldPrinceStationRules } from './stationRules.js'
import { TheOldPrinceTrackRules } from './trackRules.js'
import { TheOldPrinceOperatingRules } from './roundRules.js'
import { TheOldPrinceCompanyRules } from './companyRules.js'
import { TheOldPrinceStockRules } from './stockRules.js'
import type { GameDefinition } from '@tabletop/common'
import { TheOldPrinceInfo } from './definition/info.js'
import {
    createEighteenXXRuntime,
    defineAction,
    type EighteenXXState,
    type EighteenXXTitleRules,
    type HydratedEighteenXXState
} from '@tabletop/18xx'

export const TheOldPrinceTitleRules: EighteenXXTitleRules = {
    endingRules: TheOldPrinceEndingRules,
    decisionHandlers: { StockRound: (family) => new TheOldPrinceStockRoundHandler(family) },
    titleActions: [
        defineAction(SplitCompany, isSplitCompany, (action) => new HydratedSplitCompany(action))
    ],
    offerAuctionRules: TheOldPrinceAuctionRules,
    trainFundingRules: TheOldPrinceTrainFundingRules,
    transferRules: TheOldPrinceTransferRules,
    privatePowerRules: TheOldPrincePrivatePowerRules,
    createOpening: createTheOldPrinceOpening,
    stockRules: TheOldPrinceStockRules,
    companyRules: TheOldPrinceCompanyRules,
    operatingRules: TheOldPrinceOperatingRules,
    trackRules: TheOldPrinceTrackRules,
    stationRules: TheOldPrinceStationRules,
    earningsRules: TheOldPrinceEarningsRules,
    routeRules: TheOldPrinceRouteRules,
    privateRules: TheOldPrincePrivateRules,
    phases: TheOldPrincePhases,
    phaseRules: TheOldPrincePhaseRules,
    trainRules: TheOldPrinceTrainRules
}

export const Definition: GameDefinition<EighteenXXState, HydratedEighteenXXState> = {
    info: TheOldPrinceInfo,
    runtime: createEighteenXXRuntime(TheOldPrinceTitleRules)
}
