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
    decisionHandlers: { StartingOperatingSet: capitalizesFloatedCompanies },
    titleActions: [
        defineAction(
            CapitalizeCompany,
            isCapitalizeCompany,
            (action) => new HydratedCapitalizeCompany(action)
        )
    ]
}

export const Definition: GameDefinition<EighteenThirtyTwoState, HydratedEighteenThirtyTwoState> = {
    info: EighteenThirtyTwoInfo,
    runtime: createEighteenXXRuntime(EighteenThirtyTwoTitleRules)
}
