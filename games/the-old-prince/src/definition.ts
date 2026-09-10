import { prepareTheOldPrinceEnding } from './endingExample.js'
import { TheOldPrinceEndingRules } from './endingRules.js'
import { TheOldPrinceStockRoundHandler } from './stockRoundHandler.js'
import { SplitCompany, HydratedSplitCompany, isSplitCompany } from './splitCompany.js'
import { TheOldPrinceAuctionRules } from './openingAuction.js'
import { TheOldPrinceTrainFundingRules } from './trainFundingRules.js'
import { TheOldPrinceTransferRules } from './transferRules.js'
import { TheOldPrincePrivatePowerRules } from './privatePowerRules.js'
import { TheOldPrincePrivateRules } from './privateRules.js'
import { TheOldPrincePhaseRules } from './phaseRules.js'
import { TheOldPrinceEarningsRules } from './earningsRules.js'
import { TheOldPrinceRouteRules } from './routeRules.js'
import { TheOldPrinceTrainRules } from './trains.js'
import { TheOldPrinceStationRules } from './stationRules.js'
import { TheOldPrinceTrackRules } from './trackRules.js'
import { TheOldPrinceMap } from './map.js'
import { TheOldPrinceTileSet } from './tiles.js'
import { TheOldPrinceOperatingRules } from './roundRules.js'
import { TheOldPrinceCompanyRules } from './companyRules.js'
import { createTheOldPrinceStockMarket } from './stockMarket.js'
import { TheOldPrinceStockRules } from './stockRules.js'
import { type GameDefinition } from '@tabletop/common'
import {
    createFinanceExampleRuntime,
    FinanceExampleConfigurator,
    type FinanceExampleState,
    type HydratedFinanceExampleState
} from '@tabletop/18xx'
import { createTheOldPrinceCompanyExample } from './companyExamples.js'

const FinanceRuntime = createFinanceExampleRuntime({
    endingRules: TheOldPrinceEndingRules,
    prepareEndingExample: prepareTheOldPrinceEnding,
    stockRoundHandler: new TheOldPrinceStockRoundHandler(),
    offerAuctionRules: TheOldPrinceAuctionRules,
    defaultPosition: 'opening',
    trainFundingRules: TheOldPrinceTrainFundingRules,
    transferRules: TheOldPrinceTransferRules,
    privatePowerRules: TheOldPrincePrivatePowerRules,
    createFinances: createTheOldPrinceCompanyExample,
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
    phaseRules: TheOldPrincePhaseRules,
    trainRules: TheOldPrinceTrainRules
})

export const Definition: GameDefinition<FinanceExampleState, HydratedFinanceExampleState> = {
    info: {
        configurator: new FinanceExampleConfigurator(),
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
            beta: true
        }
    },
    runtime: {
        ...FinanceRuntime,
        apiActions: { ...FinanceRuntime.apiActions, SplitCompany },
        hydrator: {
            ...FinanceRuntime.hydrator,
            hydrateAction: (action) =>
                isSplitCompany(action)
                    ? new HydratedSplitCompany(action)
                    : FinanceRuntime.hydrator.hydrateAction(action)
        }
    }
}
