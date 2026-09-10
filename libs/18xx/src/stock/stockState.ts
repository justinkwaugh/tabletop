import { copyFinances } from '../finance/finance.js'
import type { GameState } from '@tabletop/common'
import type { CompanyState } from '../company/companyState.js'
import type { StockMarket } from './stockMarket.js'
import type { StockRound } from './stockRound.js'

export type StockState = CompanyState &
    Pick<GameState, 'players' | 'activePlayerIds' | 'turnManager'> & {
        stockRound: StockRound
        stockMarket: StockMarket
    }

export function copyStockState(state: StockState): StockState {
    return {
        ...state,
        ...copyFinances(state),
        stockMarket: {
            spaces: state.stockMarket.spaces,
            stacks: state.stockMarket.stacks.map((stack) => ({
                ...stack,
                companyIds: [...stack.companyIds]
            }))
        }
    }
}
