import { Shikoku1889SharePurchaseRules } from './sharePurchase.js'
import { type GameDefinition } from '@tabletop/common'
import {
    createFinanceExampleRuntime,
    type FinanceExampleState,
    type HydratedFinanceExampleState
} from '@tabletop/18xx'
import { createShikoku1889FinanceExample } from './finance.js'

export const Definition: GameDefinition<FinanceExampleState, HydratedFinanceExampleState> = {
    info: {
        id: 'shikoku-1889',
        metadata: {
            name: 'Shikoku 1889 · finance example',
            designer: 'Yasutaka Ikeda',
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
        createShikoku1889FinanceExample,
        Shikoku1889SharePurchaseRules
    )
}
