import {
    EighteenXXTransferTiming,
    bankExhaustionAtSetEnd,
    certificateWealthItem,
    floatedCompaniesInMarketOrder,
    getCompany,
    marketDiscardOrder,
    marketShareValue,
    payOrWithholdEarningsRules,
    presidentTrainFundingRules,
    privateOwner,
    type EndingRules,
    type EndingState,
    type GameEnding,
    type OperatingRules,
    type PhaseRules,
    type PrivateRules,
    type TransferRules
} from '@tabletop/18xx'
import { PrivateCatalog1882 } from './companies.js'
import { IpoPoolId1882, MarketPoolId1882, Names1882 } from './names.js'
import { Charters1882, ShareTrading1882, StockRules1882 } from './stock.js'
import { EndSpaceId, Market1882 } from './stockMarket.js'
import { Phases1882 } from './trains.js'

export const OperatingRules1882: OperatingRules = {
    charters: Charters1882,
    roundCount: (state) => Phases1882.phase(state.phaseId).operatingRounds,
    companyOrder: (state) => floatedCompaniesInMarketOrder(Market1882, state)
}

export const EarningsRules1882 = payOrWithholdEarningsRules(Market1882, Charters1882, {
    unpaidPoolIds: [IpoPoolId1882],
    companyPoolIds: [MarketPoolId1882]
})

export const PhaseRules1882: PhaseRules = {
    rustTiming: (state, train) => Phases1882.rustTiming(state.phaseId, train.definitionId),
    discardOrder: (state, companyId) => marketDiscardOrder(Market1882, state, companyId),
    // Trains over the limit leave the game (§11.7; the designer's ruling).
    discardDestination: 'removed'
}

export const PrivateRules1882: PrivateRules = {
    exchangeTerms: () => undefined,
    phaseEffects: (state) => PrivateCatalog1882.closureEffects(state),
    operationEffects: () => [],
    description: (_state, id) => PrivateCatalog1882.definition(id).description ?? '',
    blocking: PrivateCatalog1882.blocking.bind(PrivateCatalog1882)
}

export const TransferRules1882: TransferRules = {
    ...EighteenXXTransferTiming,
    charters: Charters1882,
    // Trains change hands between companies for $1 or more; from phase 3 companies buy
    // player-owned privates for half to twice their face value (§7.1, §8, §11.7).
    priceRange(state, _companyId, asset) {
        if (asset.kind === 'train') return { minimum: 1 }
        if (asset.kind !== 'private') return undefined
        return Phases1882.isAtLeast(state.phaseId, '3') &&
            privateOwner(state, asset.privateCompanyId)?.kind === 'player'
            ? PrivateCatalog1882.priceRange(asset.privateCompanyId)
            : undefined
    },
    afterPurchase: () => {}
}

export const TrainFundingRules1882 = presidentTrainFundingRules({
    repeatSales: 'separate',
    companyOrder: OperatingRules1882.companyOrder,
    saleTerms: ShareTrading1882.emergencySaleTerms,
    stockRules: StockRules1882,
    // The operating company's presidency cannot change in emergency money raising (§11.8).
    protectsPresidency: (companyId, operatingCompanyId) => companyId === operatingCompanyId
})

export const MarketTopReason = 'A share price reached the top of the market'

/**
 * A price on the top-right space ends the game: at once after a stock round, at the end of an
 * operating round in which a dividend took it there (§12).
 */
function marketTopEnding(state: EndingState): GameEnding | undefined {
    if (!state.stockMarket.stacks.some((stack) => stack.spaceId === EndSpaceId)) return undefined
    const set = state.operatingSet
    return set && !set.completed
        ? {
              reason: MarketTopReason,
              finalOperatingSet: set.number,
              finalOperatingRound: set.roundNumber
          }
        : { reason: MarketTopReason }
}

export const EndingRules1882: EndingRules = {
    // Bankruptcy ends the game at once; the bank breaking at the end of the set (§12).
    trigger: (state) =>
        state.bankruptcy
            ? { reason: 'Bankruptcy' }
            : (marketTopEnding(state) ?? bankExhaustionAtSetEnd(state)),
    // Shares count at market value and open privates at face value (§12).
    certificateItems(state, certificate) {
        const company = getCompany(state, certificate.companyId)
        const value = company.closed
            ? 0
            : certificate.kind === 'share'
              ? marketShareValue(Market1882, state, certificate)
              : PrivateCatalog1882.faceValue(company.id)
        return [certificateWealthItem(Names1882, certificate, value)]
    }
}
