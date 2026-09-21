import { EighteenXXPreferenceDefinition } from '@tabletop/18xx'
import { Shikoku1889EndingRules } from './endingRules.js'
import { Shikoku1889AuctionRules, createShikoku1889Opening } from './openingAuction.js'
import { Shikoku1889TrainFundingRules } from './trainFundingRules.js'
import { Shikoku1889TransferRules } from './transferRules.js'
import { Shikoku1889PrivatePowerRules } from './privatePowerRules.js'
import { Shikoku1889PrivateRules } from './privateRules.js'
import { Shikoku1889PhaseRules } from './phaseRules.js'
import { Shikoku1889EarningsRules } from './earningsRules.js'
import { Shikoku1889RouteRules } from './routeRules.js'
import { Shikoku1889Phases, Shikoku1889TrainRules } from './trains.js'
import { Shikoku1889StationRules } from './stationRules.js'
import { Shikoku1889TrackRules } from './trackRules.js'
import { Shikoku1889OperatingRules } from './roundRules.js'
import { Shikoku1889CompanyRules } from './companyRules.js'
import { Shikoku1889StockRules } from './stockRules.js'
import { type GameDefinition } from '@tabletop/common'
import {
    createEighteenXXRuntime,
    type EighteenXXState,
    type EighteenXXTitleRules,
    type HydratedEighteenXXState
} from '@tabletop/18xx'

export const Shikoku1889TitleRules: EighteenXXTitleRules = {
    endingRules: Shikoku1889EndingRules,
    auctionRules: Shikoku1889AuctionRules,
    trainFundingRules: Shikoku1889TrainFundingRules,
    transferRules: Shikoku1889TransferRules,
    privatePowerRules: Shikoku1889PrivatePowerRules,
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

export const Definition: GameDefinition<EighteenXXState, HydratedEighteenXXState> = {
    info: {
        preferences: EighteenXXPreferenceDefinition,
        id: 'shikoku-1889',
        metadata: {
            name: 'Shikoku 1889',
            designer: 'Yasutaka Ikeda',
            year: '',
            description: 'Railway companies on Shikoku, with a prototype interface.',
            minPlayers: 2,
            maxPlayers: 6,
            defaultPlayerCount: 3,
            version: '0.0.1',
            beta: true
        }
    },
    runtime: createEighteenXXRuntime(Shikoku1889TitleRules)
}

