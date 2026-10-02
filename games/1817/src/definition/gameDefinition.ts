import { type GameDefinition } from '@tabletop/common'
import {
    createEighteenXXRuntime,
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
    trainRules: EighteenSeventeenTrainRules
}

export const Definition: GameDefinition<EighteenXXState, HydratedEighteenXXState> = {
    info: EighteenSeventeenInfo,
    runtime: createEighteenXXRuntime(EighteenSeventeenTitleRules)
}
