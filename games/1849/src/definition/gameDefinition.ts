import { defineGame, type GameDefinition } from '@tabletop/common'
import { LoanRules1849 } from '../bonds.js'
import { AccessRightRules1849 } from '../electricDreams.js'
import { createEighteenXXRuntime, type EighteenXXTitleRules } from '@tabletop/18xx'
import { Names1849 } from '../names.js'
import { AuctionRules1849, createOpening1849 } from '../opening.js'
import {
    CorporateFinanceRules1849,
    EarningsRules1849,
    EndingRules1849,
    OperatingRules1849,
    PhaseRules1849,
    PrivateRules1849,
    TrainFundingRules1849,
    TrainRules1849,
    TransferRules1849,
    ZeroPriceClosure1849
} from '../operating.js'
import { PrivatePowerRules1849 } from '../privatePowers.js'
import { RouteRules1849 } from '../routes.js'
import { startingCash1849 } from '../setup.js'
import { State1849, StateDefinition1849, type HydratedState1849 } from '../state.js'
import { StationRules1849 } from '../stations.js'
import { CompanyRules1849, StockRules1849, reviewsGaribaldi1849 } from '../stock.js'
import { TrackRules1849 } from '../track.js'
import { Phases1849 } from '../trains.js'
import { Info1849 } from './info.js'

export const TitleRules1849: EighteenXXTitleRules<typeof State1849, HydratedState1849> = {
    state: StateDefinition1849,
    endingRules: EndingRules1849,
    names: Names1849,
    auctionRules: AuctionRules1849,
    createOpening: createOpening1849,
    startingCash: startingCash1849,
    // A no-break space keeps the lira sign on the line of its amount, as the rulebook writes it.
    currencySymbol: 'L.\u00a0',
    stockRules: StockRules1849,
    // The Bonds variant's bonds, as the family's corporate loans (§14.2).
    loanRules: LoanRules1849,
    // The Electric Dreams variant's E tokens, as the family's access rights (§14.3).
    accessRightRules: AccessRightRules1849,
    companyRules: CompanyRules1849,
    operatingRules: OperatingRules1849,
    trackRules: TrackRules1849,
    stationRules: StationRules1849,
    earningsRules: EarningsRules1849,
    routeRules: RouteRules1849,
    trainRules: TrainRules1849,
    runInstructions: true,
    phases: Phases1849,
    phaseRules: PhaseRules1849,
    trainFundingRules: TrainFundingRules1849,
    privateRules: PrivateRules1849,
    privatePowerRules: PrivatePowerRules1849,
    transferRules: TransferRules1849,
    corporateFinanceRules: CorporateFinanceRules1849,
    zeroPriceClosure: ZeroPriceClosure1849,
    decisionHandlers: { OperatingSet: (family) => reviewsGaribaldi1849(family) }
}

export const Definition: GameDefinition<State1849, HydratedState1849> = defineGame({
    info: Info1849,
    runtime: createEighteenXXRuntime(TitleRules1849)
})
