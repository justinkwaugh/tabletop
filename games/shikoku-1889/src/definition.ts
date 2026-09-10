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
            name: 'Shikoku 1889 · finance example',
            designer: 'Yasutaka Ikeda',
            year: '',
            description:
                'Prepared three-player positions for stock trading, company formation, and flotation.',
            minPlayers: 3,
            maxPlayers: 3,
            defaultPlayerCount: 3,
            version: '0.0.1',
            beta: true
        }
    },
    runtime: createFinanceExampleRuntime({
        createFinances: createShikoku1889CompanyExample,
        stockRules: Shikoku1889StockRules,
        createMarket: createShikoku1889StockMarket,
        companyRules: Shikoku1889CompanyRules,
        operatingRules: Shikoku1889OperatingRules,
        map: Shikoku1889Map,
        tileSet: Shikoku1889TileSet,
        trackRules: Shikoku1889TrackRules
    })
}
