import type { CompanyRules } from '../company/companyRules.js'
import {
    certificateWealthItem,
    marketShareValue,
    type ValuationRules
} from '../ending/finalWealth.js'
import type { PrivateRules } from '../privates/privateRules.js'
import type { StockRules } from '../stock/stockRules.js'
import { TestMarket, TestNames } from './minimalState.js'
import type { TrainFundingRules } from '../funding/trainFunding.js'
import { TrainDepot } from '../trains/trainDepot.js'
import type { TrainRules } from '../trains/trainPurchase.js'
import type { TransferRules } from '../transfers/purchaseOffer.js'

export const minimalStockRules: StockRules = {
    market: TestMarket,
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
    turnOrder: 'sell-buy-or-buy-sell'
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

export const minimalTrainRules: TrainRules = {
    depot: new TrainDepot({
        id: 'trains',
        trains: [
            {
                id: '2',
                name: '2',
                price: 100,
                distance: { measure: 'revenue-centers', maximum: 2 }
            }
        ],
        supply: [{ definitionId: '2', count: 2 }]
    }),
    exchangePrice: () => undefined,
    requiresTrain: () => false,
    availableDefinitions: () => ['2'],
    phaseAfterPurchase: (state) => state.phaseId,
    trainLimit: () => 4,
    purchaseLimit: () => 'unlimited'
}

export const minimalTrainFundingRules: TrainFundingRules = {
    sellInBlocks: true,
    includeMarketTrains: false,
    contributors: () => [],
    issuanceTerms: () => undefined,
    saleTerms: () => 'Not for sale',
    protectsPresidency: () => false,
    requiredSaleShares: () => 0
}

export const minimalTransferRules: TransferRules = {
    operatingCompany: () => undefined,
    canPurchase: () => false,
    priceRange: () => undefined,
    afterPurchase: () => {}
}

export const minimalValuationRules: ValuationRules = {
    certificateItems: (state, certificate) => [
        certificateWealthItem(
            TestNames,
            certificate,
            marketShareValue(TestMarket, state, certificate)
        )
    ]
}
