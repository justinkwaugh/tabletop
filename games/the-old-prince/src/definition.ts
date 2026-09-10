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

export const Definition: GameDefinition<FinanceExampleState, HydratedFinanceExampleState> = {
    info: {
        configurator: new FinanceExampleConfigurator(),
        id: 'the-old-prince',
        metadata: {
            name: 'The Old Prince 1871 · finance example',
            designer: 'Lucas Boyd',
            year: '',
            description:
                'Prepared positions for stock trading, company formation, and private exchanges.',
            minPlayers: 3,
            maxPlayers: 4,
            defaultPlayerCount: 3,
            version: '0.0.1',
            beta: true
        }
    },
    runtime: createFinanceExampleRuntime({
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
}
