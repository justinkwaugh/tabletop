import { stateWith } from '../game/stateWith.js'
import { copyFinances } from '../finance/finance.js'
import type { GameState } from '@tabletop/common'
import type { StockCompanyState } from '../company/companyState.js'
import type { StockMarket } from './stockMarket.js'
import type { StockRound } from './stockRound.js'

export type StockState = StockCompanyState &
    Pick<GameState, 'players' | 'activePlayerIds' | 'turnManager'> & {
        stockRound: StockRound
        stockMarket: StockMarket
        bankruptPlayerIds?: string[]
    }

export function stockStateCopies(state: StockState) {
    return {
        ...copyFinances(state),
        stockMarket: {
            stacks: state.stockMarket.stacks.map((stack) => ({
                ...stack,
                companyIds: [...stack.companyIds]
            }))
        }
    }
}

export function copyStockState(state: StockState): StockState {
    return stateWith(state, stockStateCopies(state))
}
