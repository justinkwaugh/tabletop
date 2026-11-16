import { assertExists } from '@tabletop/common'
import {
    EighteenXXTransferTiming,
    controllingOwner,
    finiteCashOwnedBy,
    trainsOwnedBy,
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
    type TrainPurchaseState,
    type TransferRules
} from '@tabletop/18xx'
import { PrivateCatalogChesapeake } from './companies.js'
import { IpoPoolIdChesapeake, MarketPoolIdChesapeake, NamesChesapeake } from './names.js'
import { privateDescription } from './opening.js'
import { ChartersChesapeake, ShareTradingChesapeake, StockRulesChesapeake } from './stock.js'
import { EndSpaceIdChesapeake, MarketChesapeake } from './stockMarket.js'
import { editionChesapeake } from './edition.js'
import {
    PhasesChesapeake,
    TrainDepotChesapeake,
    TrainRulesChesapeake,
    trainsExportedChesapeake
} from './trains.js'

export const OperatingRulesChesapeake: OperatingRules = {
    charters: ChartersChesapeake,
    roundCount: (state) => PhasesChesapeake.phase(state.phaseId).operatingRounds,
    companyOrder: (state) => floatedCompaniesInMarketOrder(MarketChesapeake, state),
    trainsToExport(state) {
        const set = state.operatingSet
        return set && set.roundNumber === set.roundCount ? trainsExportedChesapeake(state) : []
    }
}

export const EarningsRulesChesapeake = payOrWithholdEarningsRules(
    MarketChesapeake,
    ChartersChesapeake,
    { unpaidPoolIds: [IpoPoolIdChesapeake], companyPoolIds: [MarketPoolIdChesapeake] }
)

export const PhaseRulesChesapeake: PhaseRules = {
    rustTiming: (state, train) => PhasesChesapeake.rustTiming(state.phaseId, train.definitionId),
    discardOrder: (state, companyId) => marketDiscardOrder(MarketChesapeake, state, companyId),
    discardDestination: 'market'
}

export const PrivateRulesChesapeake: PrivateRules = {
    exchangeTerms: () => undefined,
    phaseEffects: (state) => PrivateCatalogChesapeake.closureEffects(state),
    operationEffects: () => [],
    description: privateDescription,
    blocking: PrivateCatalogChesapeake.blocking.bind(PrivateCatalogChesapeake)
}

/**
 * The cheapest train a company without one could buy from the bank or the bank pool, at face
 * value: it has nothing to trade in.
 */
function cheapestBankTrainPrice(state: TrainPurchaseState): number {
    const definitionIds = [
        ...(TrainRulesChesapeake.availableDefinitions?.(state) ?? []).filter(
            (definitionId) =>
                TrainDepotChesapeake.remaining(state.trainInventory, definitionId) !== 0
        ),
        ...state.trainInventory.trains
            .filter((train) => train.status === 'market')
            .map((train) => train.definitionId)
    ]
    return Math.min(
        ...definitionIds.map((id) => TrainDepotChesapeake.trainDefinition(id).price),
        Number.POSITIVE_INFINITY
    )
}

export const TransferRulesChesapeake: TransferRules = {
    ...EighteenXXTransferTiming,
    charters: ChartersChesapeake,
    // Trains change hands between companies for $1 or more; in phases 3 and 4 companies buy
    // player-owned privates for half to twice their face value.
    priceRange(state, _companyId, asset) {
        if (asset.kind === 'train') return { minimum: 1 }
        if (asset.kind !== 'private') return undefined
        return PhasesChesapeake.isAtLeast(state.phaseId, '3') &&
            !PhasesChesapeake.isAtLeast(state.phaseId, '5') &&
            privateOwner(state, asset.privateCompanyId)?.kind === 'player'
            ? PrivateCatalogChesapeake.priceRange(asset.privateCompanyId)
            : undefined
    },
    // A company that must buy a train, and cannot afford the cheapest from the bank or the bank
    // pool, may take another company's train for up to its face value, its president paying what
    // the treasury cannot (§11.8).
    purchaseFunding(state, companyId, asset) {
        if (
            asset.kind !== 'train' ||
            trainsOwnedBy(state, { kind: 'company', companyId }).length ||
            !TrainRulesChesapeake.requiresTrain(state, companyId) ||
            finiteCashOwnedBy(state, { kind: 'company', companyId }) >=
                cheapestBankTrainPrice(state)
        )
            return undefined
        const train = state.trainInventory.trains.find((entry) => entry.id === asset.trainId)
        const president = controllingOwner(state, companyId)
        assertExists(train, 'A funded purchase names a known train')
        assertExists(president, 'A company buying a train has a president')
        return {
            contributors: [president],
            maximumPrice: TrainDepotChesapeake.trainDefinition(train.definitionId).price
        }
    },
    afterPurchase: () => {}
}

export const TrainFundingRulesChesapeake = presidentTrainFundingRules({
    repeatSales: 'separate',
    companyOrder: OperatingRulesChesapeake.companyOrder,
    saleTerms: ShareTradingChesapeake.emergencySaleTerms,
    stockRules: StockRulesChesapeake,
    protectsPresidency: (companyId, operatingCompanyId) => companyId === operatingCompanyId
})

export const MarketTopReason = 'A share price reached $300'

/**
 * Off the Rails ends the game when a price reaches the $300 space: at once after a stock round's
 * sold-out rise, at the end of the operating round otherwise.
 */
function marketTopEnding(state: EndingState): GameEnding | undefined {
    if (
        !editionChesapeake(state).endsAtMarketTop ||
        !state.stockMarket.stacks.some((stack) => stack.spaceId === EndSpaceIdChesapeake)
    )
        return undefined
    const set = state.operatingSet
    return set && !set.completed
        ? {
              reason: MarketTopReason,
              finalOperatingSet: set.number,
              finalOperatingRound: set.roundNumber
          }
        : { reason: MarketTopReason }
}

export const EndingRulesChesapeake: EndingRules = {
    // Bankruptcy ends the game at once; the bank breaking at the end of the set (§12).
    trigger: (state) =>
        state.bankruptcy
            ? { reason: 'Bankruptcy' }
            : (marketTopEnding(state) ?? bankExhaustionAtSetEnd(state)),
    // Shares count at market value and open privates at face value.
    certificateItems(state, certificate) {
        const company = getCompany(state, certificate.companyId)
        const value = company.closed
            ? 0
            : certificate.kind === 'share'
              ? marketShareValue(MarketChesapeake, state, certificate)
              : PrivateCatalogChesapeake.faceValue(company.id)
        return [certificateWealthItem(NamesChesapeake, certificate, value)]
    }
}
