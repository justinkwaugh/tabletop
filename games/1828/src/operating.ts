import { assertExists } from '@tabletop/common'
import {
    EighteenXXTransferTiming,
    certificateWealthItem,
    controllingOwner,
    finiteCashOwnedBy,
    getCompany,
    hasTurnMark,
    markTurn,
    marketDiscardOrder,
    marketShareValue,
    nextOperatingCompany,
    payOrWithholdEarningsRules,
    presidentTrainFundingRules,
    privateOwner,
    sameOwner,
    sharesOwned,
    trainsOwnedBy,
    type EndingRules,
    type EndingState,
    type GameEnding,
    type OperatingRules,
    type PhaseRules,
    type PrivateRules,
    type TransferRules,
    presidentOf
} from '@tabletop/18xx'
import { PrivateCatalog1828 } from './companies.js'
import { cobourgPurchased, erieKalamazooPurchased } from './cobourg.js'
import { CobourgRailwayId, MhId } from './ids.js'
import { IpoPoolId1828, MarketPoolId1828, Names1828 } from './names.js'
import { privateIncome1828 } from './opening.js'
import { operatingOrder1828 } from './mohawkTiming.js'
import { requireState1828, type HydratedState1828 } from './state.js'
import {
    forgetShellTrain,
    nextTrainShell,
    ShellsClosedMark,
    trainBoughtFromMark,
    trainShells
} from './systems.js'
import { Charters1828, ShareTrading1828, StockRules1828 } from './stock.js'
import { EndSpaceId1828, Market1828 } from './stockMarket.js'
import { TrainRules1828 } from './trainRules.js'
import { Phases1828, PrivateClosurePhaseId, PurplePhaseId, TrainDepot1828 } from './trains.js'

export const OperatingRules1828: OperatingRules = {
    charters: Charters1828,
    // The phase at the end of the stock round sets the rounds that follow it (§5).
    roundCount: (state) => Phases1828.phase(state.phaseId).operatingRounds,
    // A player's C&P lays its tile as the privates pay; then companies by price (§8.1, §8.2).
    companyOrder: operatingOrder1828,
    privateIncome: (state, privateId) => privateIncome1828(state, privateId)
}

// Pool shares pay their company; IPO shares pay no one; a system's treasury share pays it (§8.3.4).
export const EarningsRules1828 = payOrWithholdEarningsRules(Market1828, Charters1828, {
    unpaidPoolIds: [IpoPoolId1828],
    companyPoolIds: [MarketPoolId1828]
})

export const PhaseRules1828: PhaseRules = {
    rustTiming: (state, train) => Phases1828.rustTiming(state.phaseId, train.definitionId),
    discardOrder: (state, companyId) => marketDiscardOrder(Market1828, state, companyId),
    // Trains over the limit are discarded from the game (§8.3.5.1).
    discardDestination: 'removed'
}

/** M&H trades for any 10% share of a parred company in the IPO or bank pool (§13.2.2.6). */
function mohawkShares(state: Parameters<PrivateRules['exchangeTerms']>[0]): string[] {
    const owner = privateOwner(state, MhId)
    const funding = state.machineState === 'FundingTrain' ? nextOperatingCompany(state) : undefined
    return state.certificates
        .filter((certificate) => {
            if (
                certificate.kind !== 'share' ||
                certificate.president ||
                certificate.owner.kind !== 'bank' ||
                (certificate.poolId !== IpoPoolId1828 && certificate.poolId !== MarketPoolId1828)
            )
                return false
            const company = getCompany(state, certificate.companyId)
            if (!company.started || company.closed) return false
            const president = presidentOf(state, company.id)
            // Control of the company buying a train may not change hands (§8.3.5.2).
            return !(
                company.id === funding &&
                owner &&
                president &&
                !sameOwner(owner, president) &&
                sharesOwned(state, company.id, owner) + certificate.shares >
                    sharesOwned(state, company.id, president)
            )
        })
        .map((certificate) => certificate.id)
}

export const PrivateRules1828: PrivateRules = {
    // As a stock-round action in place of a purchase, or at any time in an operating round, not
    // subject to the 60% limit (§7.1, §7.3, §13.2.2.6). A merger's share trading is not interrupted.
    exchangeTerms(state, privateCompanyId) {
        if (privateCompanyId !== MhId || requireState1828(state).merger) return undefined
        return {
            certificateIds: mohawkShares(state),
            timing: 'any-turn',
            stockAction: state.machineState === 'StockRound' ? 'purchase' : 'none',
            ownershipLimit: 'exempt'
        }
    },
    phaseEffects: (state) => PrivateCatalog1828.closureEffects(state),
    operationEffects: () => [],
    description: (_state, id) => PrivateCatalog1828.definition(id).description ?? '',
    blocking: PrivateCatalog1828.blocking.bind(PrivateCatalog1828)
}

/** Whether a funded train goes to an empty shell, as emergency buying must (§8.3.5.1). */
function fundsEmptyTrainShell(state: HydratedState1828, companyId: string): boolean {
    return (
        !(companyId in state.systems) ||
        trainShells(state, companyId)[nextTrainShell(state, companyId)].length === 0
    )
}

/**
 * Whether a sale would hand on a company the system just bought a train from, which the designer
 * rules out as a dump through two shells: a system is one company (BGG thread 2368855).
 */
export function dumpsTrainSeller(
    state: object,
    sales: readonly { companyId: string; presidency?: unknown }[]
): boolean {
    const title = requireState1828(state)
    return sales.some(
        (sale) => !!sale.presidency && hasTurnMark(title, trainBoughtFromMark(sale.companyId))
    )
}

export const TransferRules1828: TransferRules = {
    ...EighteenXXTransferTiming,
    charters: Charters1828,
    // Trains change hands for $1 or more; from green phase until red, companies buy players'
    // saleable privates for $1 to twice face value (§8.3, §8.3.5.1, §13.2.1).
    priceRange(state, companyId, asset) {
        // The C&P's half 2-train is no train another company can buy (§13.2.2.5; designer, BGG
        // thread 2162379).
        if (asset.kind === 'train')
            return trainsOwnedBy(state, { kind: 'company', companyId: CobourgRailwayId }).some(
                (train) => train.id === asset.trainId
            )
                ? undefined
                : { minimum: 1 }
        if (asset.kind !== 'private' || companyId === CobourgRailwayId) return undefined
        const range = PrivateCatalog1828.priceRange(asset.privateCompanyId)
        return range &&
            Phases1828.isAtLeast(state.phaseId, '3') &&
            !Phases1828.isAtLeast(state.phaseId, PrivateClosurePhaseId) &&
            privateOwner(state, asset.privateCompanyId)?.kind === 'player'
            ? { minimum: 1, maximum: range.maximum }
            : undefined
    },
    // A company that must buy a train and cannot afford one may take another company's for up to
    // its face value, its director paying what the treasury cannot (§8.3.5.2).
    purchaseFunding(state, companyId, asset) {
        if (
            asset.kind !== 'train' ||
            !(
                TrainRules1828.requiresTrain(state, companyId) ||
                TrainRules1828.mayRequireTrain?.(state, companyId)
            ) ||
            !fundsEmptyTrainShell(requireState1828(state), companyId)
        )
            return undefined
        const train = state.trainInventory.trains.find((entry) => entry.id === asset.trainId)
        const director = controllingOwner(state, companyId)
        assertExists(train, 'A funded purchase names a known train')
        assertExists(director, 'A company buying a train has a director')
        return {
            contributors: [director],
            maximumPrice: TrainDepot1828.trainDefinition(train.definitionId).price
        }
    },
    afterPurchase(state, offer) {
        if (offer.asset.kind === 'train') {
            const title = requireState1828(state)
            markTurn(title, ShellsClosedMark)
            if (offer.seller.kind === 'company') {
                markTurn(title, trainBoughtFromMark(offer.seller.companyId))
                forgetShellTrain(title, offer.seller.companyId, offer.asset.trainId)
            }
            return
        }
        if (offer.asset.kind !== 'private') return
        erieKalamazooPurchased(state, offer)
        cobourgPurchased(state, offer)
    }
}

export const TrainFundingRules1828 = presidentTrainFundingRules({
    repeatSales: 'extend-block',
    companyOrder: OperatingRules1828.companyOrder,
    saleTerms: ShareTrading1828.emergencySaleTerms,
    stockRules: StockRules1828,
    // Control of the company buying the train may not change hands (§8.3.5.2).
    protectsPresidency: (companyId, operatingCompanyId) => companyId === operatingCompanyId,
    permitsSale: (state, details) => !dumpsTrainSeller(state, details.sales)
})

export const BankruptcyReason = 'Bankruptcy'
export const MarketTopReason = 'A share price reached $500'
export const PurplePhaseReason = 'Purple phase'

/**
 * A price at $500 ends the game at once after a stock round, at the end of the operating round
 * otherwise (§9.1).
 */
function marketTopEnding(state: EndingState): GameEnding | undefined {
    if (!state.stockMarket.stacks.some((stack) => stack.spaceId === EndSpaceId1828))
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

export const EndingRules1828: EndingRules = {
    // Bankruptcy ends the game at once; the first set of operating rounds starting in purple
    // phase is the last (§9.1, §17.7).
    trigger(state) {
        if (state.bankruptcy) return { reason: BankruptcyReason }
        const top = marketTopEnding(state)
        if (top) return top
        if (state.phaseId === PurplePhaseId)
            return {
                reason: PurplePhaseReason,
                finalOperatingSet: (state.operatingSet?.number ?? 0) + 1
            }
        return undefined
    },
    // Shares count at their price, unparred companies' at nothing; players' privates at face
    // value (§9.2).
    certificateItems(state, certificate) {
        const company = getCompany(state, certificate.companyId)
        const value =
            company.closed || (certificate.kind === 'share' && !company.started)
                ? 0
                : certificate.kind === 'share'
                  ? marketShareValue(Market1828, state, certificate)
                  : PrivateCatalog1828.faceValue(company.id)
        return [certificateWealthItem(Names1828, certificate, value)]
    }
}

/** The C&P's treasury, which goes to the company that buys it (§13.2.2.5). */
export function cobourgTreasury(state: object): number {
    return finiteCashOwnedBy(requireState1828(state), {
        kind: 'company',
        companyId: CobourgRailwayId
    })
}
