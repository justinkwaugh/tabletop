import { TheOldPrinceNames } from '../names.js'
import { createEighteenXXRuntime, defineAction, type EighteenXXTitleRules } from '@tabletop/18xx'
import type { GameDefinition } from '@tabletop/common'
import { TheOldPrinceCompanyRules } from '../companyRules.js'
import { TheOldPrinceEarningsRules } from '../earningsRules.js'
import { TheOldPrinceEndingRules } from '../endingRules.js'
import { TheOldPrinceAuctionRules, createTheOldPrinceOpening } from '../openingAuction.js'
import { TheOldPrincePhaseRules } from '../phaseRules.js'
import { TheOldPrincePrivatePowerRules } from '../privatePowerRules.js'
import { TheOldPrincePrivateRules } from '../privateRules.js'
import { TheOldPrinceOperatingRules } from '../roundRules.js'
import { TheOldPrinceRouteRules } from '../routeRules.js'
import { HydratedSplitCompany, SplitCompany, isSplitCompany } from '../splitCompany.js'
import {
    TheOldPrinceState,
    TheOldPrinceStateDefinition,
    type HydratedTheOldPrinceState
} from '../state.js'
import { TheOldPrinceStationRules } from '../stationRules.js'
import { TheOldPrinceStockRoundHandler } from '../stockRoundHandler.js'
import { TheOldPrinceStockRules } from '../stockRules.js'
import { TheOldPrinceTrackRules } from '../trackRules.js'
import { TheOldPrinceTrainFundingRules } from '../trainFundingRules.js'
import { TheOldPrincePhases, TheOldPrinceTrainRules } from '../trains.js'
import { TheOldPrinceTransferRules } from '../transferRules.js'
import { TheOldPrinceInfo } from './info.js'

export const TheOldPrinceTitleRules: EighteenXXTitleRules<
    typeof TheOldPrinceState,
    HydratedTheOldPrinceState
> = {
    state: TheOldPrinceStateDefinition,
    endingRules: TheOldPrinceEndingRules,
    names: TheOldPrinceNames,
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

export const Definition: GameDefinition<TheOldPrinceState, HydratedTheOldPrinceState> = {
    info: TheOldPrinceInfo,
    runtime: createEighteenXXRuntime(TheOldPrinceTitleRules)
}
