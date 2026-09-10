import { prepareShikoku1889Ending } from './endingExample.js'
import { Shikoku1889EndingRules } from './endingRules.js'
import { Shikoku1889AuctionRules } from './openingAuction.js'
import { Shikoku1889TrainFundingRules } from './trainFundingRules.js'
import { Shikoku1889TransferRules } from './transferRules.js'
import { Shikoku1889PrivatePowerRules } from './privatePowerRules.js'
import { Shikoku1889PrivateRules } from './privateRules.js'
import { Shikoku1889PhaseRules } from './phaseRules.js'
import { Shikoku1889EarningsRules } from './earningsRules.js'
import { Shikoku1889RouteRules } from './routeRules.js'
import { Shikoku1889TrainRules } from './trains.js'
import { Shikoku1889StationRules } from './stationRules.js'
import { Shikoku1889TrackRules } from './trackRules.js'
import { Shikoku1889Map } from './map.js'
import { Shikoku1889TileSet } from './tiles.js'
import { Shikoku1889OperatingRules } from './roundRules.js'
import { Shikoku1889CompanyRules } from './companyRules.js'
import { createShikoku1889StockMarket } from './stockMarket.js'
import { Shikoku1889StockRules } from './stockRules.js'
import { type GameDefinition } from '@tabletop/common'
import {
    createFinanceExampleRuntime,
    FinanceExampleConfigurator,
    type FinanceExampleState,
    type HydratedFinanceExampleState
} from '@tabletop/18xx'
import { createShikoku1889CompanyExample } from './companyExamples.js'

export const Definition: GameDefinition<FinanceExampleState, HydratedFinanceExampleState> = {
    info: {
        configurator: new FinanceExampleConfigurator(),
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
    runtime: createFinanceExampleRuntime({
        endingRules: Shikoku1889EndingRules,
        prepareEndingExample: prepareShikoku1889Ending,
        auctionRules: Shikoku1889AuctionRules,
        defaultPosition: 'opening',
        trainFundingRules: Shikoku1889TrainFundingRules,
        transferRules: Shikoku1889TransferRules,
        privatePowerRules: Shikoku1889PrivatePowerRules,
        createFinances: createShikoku1889CompanyExample,
        stockRules: Shikoku1889StockRules,
        createMarket: createShikoku1889StockMarket,
        companyRules: Shikoku1889CompanyRules,
        operatingRules: Shikoku1889OperatingRules,
        map: Shikoku1889Map,
        tileSet: Shikoku1889TileSet,
        trackRules: Shikoku1889TrackRules,
        stationRules: Shikoku1889StationRules,
        earningsRules: Shikoku1889EarningsRules,
        routeRules: Shikoku1889RouteRules,
        privateRules: Shikoku1889PrivateRules,
        phaseRules: Shikoku1889PhaseRules,
        trainRules: Shikoku1889TrainRules
    })
}
