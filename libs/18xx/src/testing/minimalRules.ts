import type { CompanyRules } from '../company/companyRules.js'
import type { PrivateRules } from '../privates/privateRules.js'
import type { StockRules } from '../stock/stockRules.js'

export const minimalStockRules: StockRules = {
    round: {
        passing: 'consecutive',
        nextPlayerOrder: (state) => [...state.turnManager.turnOrder],
        soldOut: () => false
    },
    sellers: (_state, playerId) => [{ kind: 'player', playerId }],
    buyers: (_state, playerId) => [{ kind: 'player', playerId }],
    purchaseTerms: () => 'Not for sale',
    saleTerms: () => 'Not for sale',
    certificateLimit: () => 10,
    certificateWeight: () => 1,
    ownershipLimit: () => 60,
    presidencyCandidates: () => [],
    sellAfterBuying: true
}

export const minimalCompanyRules: CompanyRules = {
    startMarketSpaces: () => [],
    startTerms: () => 'Cannot start',
    flotationPayments: () => undefined
}

export const minimalPrivateRules: PrivateRules = {
    exchangeTerms: () => undefined,
    phaseEffects: () => [],
    operationEffects: () => [],
    description: (_state, privateCompanyId) => `About ${privateCompanyId}`
}
