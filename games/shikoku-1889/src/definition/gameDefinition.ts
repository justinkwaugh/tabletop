import { Shikoku1889Names } from '../names.js'
import { createEighteenXXRuntime, type EighteenXXTitleRules } from '@tabletop/18xx'
import { type GameDefinition } from '@tabletop/common'
import { Shikoku1889CompanyRules } from '../companyRules.js'
import { Shikoku1889EarningsRules } from '../earningsRules.js'
import { Shikoku1889EndingRules } from '../endingRules.js'
import { Shikoku1889AuctionRules, createShikoku1889Opening } from '../openingAuction.js'
import { Shikoku1889PhaseRules } from '../phaseRules.js'
import { Shikoku1889PrivatePowerRules } from '../privatePowerRules.js'
import { Shikoku1889PrivateRules } from '../privateRules.js'
import { Shikoku1889OperatingRules } from '../roundRules.js'
import { Shikoku1889RouteRules } from '../routeRules.js'
import {
    Shikoku1889State,
    Shikoku1889StateDefinition,
    type HydratedShikoku1889State
} from '../state.js'
import { Shikoku1889StationRules } from '../stationRules.js'
import { Shikoku1889StockRules } from '../stockRules.js'
import { Shikoku1889TrackRules } from '../trackRules.js'
import { Shikoku1889TrainFundingRules } from '../trainFundingRules.js'
import { Shikoku1889Phases, Shikoku1889TrainRules } from '../trains.js'
import { Shikoku1889TransferRules } from '../transferRules.js'
import { Shikoku1889Info } from './info.js'

export const Shikoku1889TitleRules: EighteenXXTitleRules<
    typeof Shikoku1889State,
    HydratedShikoku1889State
> = {
    state: Shikoku1889StateDefinition,
    endingRules: Shikoku1889EndingRules,
    names: Shikoku1889Names,
    auctionRules: Shikoku1889AuctionRules,
    trainFundingRules: Shikoku1889TrainFundingRules,
    transferRules: Shikoku1889TransferRules,
    privatePowerRules: Shikoku1889PrivatePowerRules,
    outOfTurnPrivatePowers: true,
    createOpening: createShikoku1889Opening,
    stockRules: Shikoku1889StockRules,
    companyRules: Shikoku1889CompanyRules,
    operatingRules: Shikoku1889OperatingRules,
    trackRules: Shikoku1889TrackRules,
    stationRules: Shikoku1889StationRules,
    earningsRules: Shikoku1889EarningsRules,
    routeRules: Shikoku1889RouteRules,
    privateRules: Shikoku1889PrivateRules,
    phases: Shikoku1889Phases,
    phaseRules: Shikoku1889PhaseRules,
    trainRules: Shikoku1889TrainRules
}

export const Definition: GameDefinition<Shikoku1889State, HydratedShikoku1889State> = {
    info: Shikoku1889Info,
    runtime: createEighteenXXRuntime(Shikoku1889TitleRules)
}
