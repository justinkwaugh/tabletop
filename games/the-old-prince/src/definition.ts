import { EighteenXXPreferenceDefinition } from '@tabletop/18xx'
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
import { TheOldPrinceMap } from './map.js'
import { TheOldPrinceTileSet } from './tiles.js'
import { TheOldPrinceOperatingRules } from './roundRules.js'
import { TheOldPrinceCompanyRules } from './companyRules.js'
import { createTheOldPrinceStockMarket } from './stockMarket.js'
import { TheOldPrinceStockRules } from './stockRules.js'
import { GameVisibility, type GameDefinition } from '@tabletop/common'
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
    createFinances: createTheOldPrinceOpening,
    stockRules: TheOldPrinceStockRules,
    createMarket: createTheOldPrinceStockMarket,
    companyRules: TheOldPrinceCompanyRules,
    operatingRules: TheOldPrinceOperatingRules,
    map: TheOldPrinceMap,
    tileSet: TheOldPrinceTileSet,
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
    info: {
        preferences: EighteenXXPreferenceDefinition,
        id: 'the-old-prince',
        metadata: {
            name: 'The Old Prince 1871',
            designer: 'Lucas Boyd',
            year: '',
            description: 'Railway companies on Prince Edward Island, with a prototype interface.',
            minPlayers: 3,
            maxPlayers: 4,
            defaultPlayerCount: 3,
            version: '0.0.1',
            beta: true,
            visibility: GameVisibility.Alpha
        }
    },
    runtime: createEighteenXXRuntime(TheOldPrinceTitleRules)
}
