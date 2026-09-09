import type { GameState } from '@tabletop/common'
import type { CompanyState } from '../company/companyState.js'
import type { StockMarket } from './stockMarket.js'
import type { StockRound } from './stockRound.js'

export type StockState = CompanyState &
    Pick<GameState, 'players' | 'activePlayerIds' | 'turnManager'> & {
        stockRound: StockRound
        stockMarket: StockMarket
    }
