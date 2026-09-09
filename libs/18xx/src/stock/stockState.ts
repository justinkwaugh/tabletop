import type { GameState } from '@tabletop/common'
import type { FinancialState } from '../finance/finance.js'
import type { StockMarket } from './stockMarket.js'
import type { StockRound } from './stockRound.js'

export type StockState = FinancialState &
    Pick<GameState, 'players' | 'activePlayerIds' | 'turnManager'> & {
        stockRound: StockRound
        stockMarket: StockMarket
    }
