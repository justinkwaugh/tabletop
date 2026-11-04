import type { GameDefinition } from '@tabletop/common'
import { createEighteenXXRuntime, type EighteenXXTitleRules } from '@tabletop/18xx'
import { EighteenNinetyFourNames } from '../names.js'
import { EighteenNinetyFourEndingRules } from '../endingRules.js'
import {
    EighteenNinetyFourAuctionRules,
    createEighteenNinetyFourOpening,
    eighteenNinetyFourStartingCash
} from '../openingAuction.js'
import { EighteenNinetyFourTrainFundingRules } from '../trainFundingRules.js'
import { EighteenNinetyFourTransferRules } from '../transferRules.js'
import { EighteenNinetyFourPrivatePowerRules } from '../privatePowerRules.js'
import { EighteenNinetyFourPrivateRules } from '../privateRules.js'
import { EighteenNinetyFourPhaseRules } from '../phaseRules.js'
import { EighteenNinetyFourEarningsRules } from '../earningsRules.js'
import { EighteenNinetyFourRouteRules } from '../routeRules.js'
import { EighteenNinetyFourPhases } from '../trains.js'
import { EighteenNinetyFourTrainRules } from '../trainRules.js'
import { EighteenNinetyFourStationRules } from '../stationRules.js'
import { EighteenNinetyFourTrackRules } from '../trackRules.js'
import { EighteenNinetyFourOperatingRules } from '../roundRules.js'
import { EighteenNinetyFourCompanyRules } from '../companyRules.js'
import { EighteenNinetyFourStockRules } from '../stockRules.js'
import { EighteenNinetyFourInfo } from './info.js'
import { EighteenNinetyFourAccessRightRules } from '../london.js'
import { EighteenNinetyFourCorporateFinanceRules } from '../corporateFinance.js'
import {
    EighteenNinetyFourStateDefinition,
    EighteenNinetyFourState,
    type HydratedEighteenNinetyFourState
} from '../state.js'

export const EighteenNinetyFourTitleRules: EighteenXXTitleRules<
    typeof EighteenNinetyFourState,
    HydratedEighteenNinetyFourState
> = {
    state: EighteenNinetyFourStateDefinition,
    endingRules: EighteenNinetyFourEndingRules,
    names: EighteenNinetyFourNames,
    auctionRules: EighteenNinetyFourAuctionRules,
    trainFundingRules: EighteenNinetyFourTrainFundingRules,
    transferRules: EighteenNinetyFourTransferRules,
    privatePowerRules: EighteenNinetyFourPrivatePowerRules,
    createOpening: createEighteenNinetyFourOpening,
    startingCash: eighteenNinetyFourStartingCash,
    currencySymbol: 'F',
    stockRules: EighteenNinetyFourStockRules,
    companyRules: EighteenNinetyFourCompanyRules,
    operatingRules: EighteenNinetyFourOperatingRules,
    trackRules: EighteenNinetyFourTrackRules,
    stationRules: EighteenNinetyFourStationRules,
    earningsRules: EighteenNinetyFourEarningsRules,
    routeRules: EighteenNinetyFourRouteRules,
    privateRules: EighteenNinetyFourPrivateRules,
    phases: EighteenNinetyFourPhases,
    phaseRules: EighteenNinetyFourPhaseRules,
    trainRules: EighteenNinetyFourTrainRules,
    runInstructions: true,
    accessRightRules: EighteenNinetyFourAccessRightRules,
    corporateFinanceRules: EighteenNinetyFourCorporateFinanceRules
}

export const Definition: GameDefinition<EighteenNinetyFourState, HydratedEighteenNinetyFourState> =
    {
        info: EighteenNinetyFourInfo,
        runtime: createEighteenXXRuntime(EighteenNinetyFourTitleRules)
    }
