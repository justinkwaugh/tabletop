import { createTheOldPrinceStockMarket } from './stockMarket.js'
import { TheOldPrinceStockRules } from './stockRules.js'
import { type GameDefinition } from '@tabletop/common'
import {
    createFinanceExampleRuntime,
    type FinanceExampleState,
    type HydratedFinanceExampleState
} from '@tabletop/18xx'
import { createTheOldPrinceFinanceExample } from './finance.js'

export const Definition: GameDefinition<FinanceExampleState, HydratedFinanceExampleState> = {
    info: {
        id: 'the-old-prince',
        metadata: {
            name: 'The Old Prince 1871 · finance example',
            designer: 'Lucas Boyd',
            year: '',
            description:
                'A three-player example position for inspecting cash, certificates, and control.',
            minPlayers: 3,
            maxPlayers: 3,
            defaultPlayerCount: 3,
            version: '0.0.1',
            beta: true
        }
    },
    runtime: createFinanceExampleRuntime(
        createTheOldPrinceFinanceExample,
        TheOldPrinceStockRules,
        createTheOldPrinceStockMarket
    )
}
