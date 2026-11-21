import { assertExists } from '@tabletop/common'
import {
    EighteenXXTransferTiming,
    bankBrokenRoundEnding,
    certificateWealthItem,
    controllingOwner,
    floatedCompaniesInMarketOrder,
    getCompany,
    presidentOf,
    isObsoleteTrain,
    marketDiscardOrder,
    payOrWithholdEarningsRules,
    presidentTrainFundingRules,
    privateOwner,
    privatePowerUsed,
    requiresStationRoute,
    type EarningsRules,
    type EndingRules,
    type EndingState,
    type GameEnding,
    type OperatingRules,
    type PhaseRules,
    type PrivatePowerRules,
    type PrivateRules,
    type StockState,
    type TrainRules,
    type TransferRules
} from '@tabletop/18xx'
import {
    ChartersMex,
    KcmoId,
    MinorIdsMex,
    isMinorMex,
    MinorsMex,
    MnrId,
    NdmId,
    PrivateCatalogMex,
    minorMex
} from './companies.js'
import { CopperCanyonLocationId, MapMex } from './map.js'
import { IpoPoolIdMex, MarketPoolIdMex, NamesMex, TradeInPoolIdMex } from './names.js'
import { PhaseChangesMex, mergerDecisionState } from './merger.js'
import { requireStateMex } from './state.js'
import { trainLimitMex } from './trainLimits.js'
import { StockRulesMex, emergencySaleTermsMex, ndmUnitsValue } from './stock.js'
import { EndPrice, MarketMex } from './stockMarket.js'
import { CopperCanyonTileId, TileSetMex } from './tiles.js'
import {
    MinorTrainId,
    PhasesMex,
    SixHalfPhaseId,
    TrainDepotMex,
    phaseAfterPurchaseMex
} from './trains.js'

/** The majors that have floated, by market value, the higher first (4(c)). */
function majorOrder(state: Pick<StockState, 'companies' | 'stockMarket'>): string[] {
    return floatedCompaniesInMarketOrder(MarketMex, state).filter((id) => !isMinorMex(id))
}

/** The minors players own, A, B and C in turn, then the floated majors (4(b), 4(c)). */
export function companyOrderMex(state: Pick<StockState, 'companies' | 'stockMarket'>): string[] {
    const minors = MinorIdsMex.filter((id) => {
        const minor = getCompany(state, id)
        return !!minor.started && !minor.closed
    })
    return [...minors, ...majorOrder(state)]
}

export const OperatingRulesMex: OperatingRules = {
    charters: ChartersMex,
    roundCount: (state) => PhasesMex.phase(state.phaseId).operatingRounds,
    companyOrder: companyOrderMex
}

const PayOrWithhold = payOrWithholdEarningsRules(MarketMex, ChartersMex, {
    unpaidPoolIds: [IpoPoolIdMex, TradeInPoolIdMex],
    companyPoolIds: [MarketPoolIdMex]
})

/**
 * A major pays out or withholds, moving right or left; a minor pays half to its owner and keeps
 * half, never moving (4.2(d), 4.3.3). The NdM's 5% units pay half a 10% share's dividend, an odd
 * one rounded up (4.3.3(a)).
 */
export const EarningsRulesMex: EarningsRules = {
    ...PayOrWithhold,
    choices: (_state, companyId) => (isMinorMex(companyId) ? ['half-pay'] : ['pay', 'withhold']),
    automaticChoice: (_state, companyId) => (isMinorMex(companyId) ? 'half-pay' : undefined),
    entitlements(state, companyId) {
        if (!isMinorMex(companyId)) return PayOrWithhold.entitlements(state, companyId)
        const owner = presidentOf(state, companyId)
        assertExists(owner, 'An operating minor has its owner')
        return [{ owner: { ...owner }, shares: 1 }]
    },
    retainedRevenue(state, companyId, choice, revenue) {
        if (choice === 'half-pay') return revenue / 2
        return PayOrWithhold.retainedRevenue(state, companyId, choice, revenue)
    },
    roundDividend: (_state, companyId, amount) =>
        companyId === NdmId ? Math.ceil(amount) : amount,
    holderDividend(_state, companyId, { shares, choice, revenue }) {
        if (companyId !== NdmId || choice !== 'pay') return undefined
        return Math.floor(shares / 2) * (revenue / 10) + (shares % 2) * Math.ceil(revenue / 20)
    },
    marketEffect: (state, companyId, distribution) =>
        isMinorMex(companyId)
            ? { bonusPerShare: 0 }
            : PayOrWithhold.marketEffect(state, companyId, distribution)
}

export const TrainRulesMex: TrainRules = {
    depot: TrainDepotMex,
    // A major with a route must own a train, unless the bank has none left; a minor has its
    // own (4.3.4.2, 1.3.3).
    requiresTrain: (state, companyId) =>
        !isMinorMex(companyId) &&
        state.trainInventory.trains.some((train) => train.status !== 'owned') &&
        requiresStationRoute(MapMex, TileSetMex)(state, companyId),
    availableDefinitions: (state) => {
        const next = TrainDepotMex.nextDefinitionId(state.trainInventory)
        return next && next !== MinorTrainId ? [next] : []
    },
    exchangePrice: () => undefined,
    phaseAfterPurchase: (state, definitionId) => phaseAfterPurchaseMex(state, definitionId),
    trainLimit: trainLimitMex,
    // Obsolete 4-trains run once more without counting toward the limit (4.3.4.1, TN-3).
    countsForLimit: (_state, train) => !isObsoleteTrain(train),
    // A minor never buys a train; a major buys at most one from the bank each turn until the
    // first 4-train (1.3.3, 4.3.4(f)).
    purchaseLimit: (state, companyId) =>
        isMinorMex(companyId) ? 0 : PhasesMex.isAtLeast(state.phaseId, '4') ? 'unlimited' : 1,
    // The MNR closes when the NdM buys its first train (Table III).
    privatesClosedByPurchase: (state, companyId) =>
        companyId === NdmId && !getCompany(state, MnrId).closed ? [MnrId] : []
}

/**
 * Phase 3½ closes the minors and phase 5 brings the NdM merger (5.2, 5.3). The 2-trains rust
 * with the first 4-train, the 3-trains with the first 6-train; the 4-trains go obsolete with the
 * second 6-train, those in the Open Market at once, or all at once under optional rule 8(d)
 * (4.3.4.1). The minors' own 2-trains go only with their minors (8(c)).
 */
export const PhaseRulesMex: PhaseRules = {
    rustTiming(state, train) {
        if (train.definitionId === MinorTrainId) return undefined
        if (train.definitionId === '4' && PhasesMex.isAtLeast(state.phaseId, SixHalfPhaseId))
            return requireStateMex(state).options.hardRust ? 'immediate' : 'after-operation'
        return PhasesMex.rustTiming(state.phaseId, train.definitionId)
    },
    discardOrder: (state, companyId) => marketDiscardOrder(MarketMex, state, companyId),
    discardDestination: 'market',
    changes: PhaseChangesMex,
    decisionState: mergerDecisionState
}

export const PrivateRulesMex: PrivateRules = {
    exchangeTerms: () => undefined,
    phaseEffects: (state) => PrivateCatalogMex.closureEffects(state),
    operationEffects: () => [],
    description: (_state, id) => {
        const minor = minorMex(id)
        if (!minor) return PrivateCatalogMex.definition(id).description ?? ''
        const share = minor.majorId === NdmId ? 'a 5% NdM' : 'a 10% UdY'
        return `Minor company with a built-in 2-train, laying one yellow tile and paying half its run to its owner. Closes at phase 3½, its owner receiving ${share} trade-in share.`
    }
}

export const TransferRulesMex: TransferRules = {
    ...EighteenXXTransferTiming,
    charters: ChartersMex,
    // A minor buys nothing, and never sells its built-in 2-train (1.3.3).
    canPurchase(state, companyId, asset) {
        if (isMinorMex(companyId)) return false
        if (asset.kind === 'train') {
            const train = state.trainInventory.trains.find((entry) => entry.id === asset.trainId)
            if (train?.definitionId === MinorTrainId) return false
        }
        return EighteenXXTransferTiming.canPurchase(state, companyId, asset)
    },
    priceRange(state, companyId, asset) {
        if (asset.kind === 'train') {
            const seller = state.trainInventory.trains.find((train) => train.id === asset.trainId)
            const sellerId =
                seller?.status === 'owned' && seller.owner.kind === 'company'
                    ? seller.owner.companyId
                    : undefined
            if (companyId !== NdmId && sellerId !== NdmId) return { minimum: 1 }
            // The NdM buys and sells trains only at face value (4.3.4(d)).
            if (!seller) return undefined
            const price = TrainDepotMex.trainDefinition(seller.definitionId).price
            return { minimum: price, maximum: price }
        }
        if (
            asset.kind !== 'private' ||
            privateOwner(state, asset.privateCompanyId)?.kind !== 'player'
        )
            return undefined
        // Under optional rule 8(b) the KCM&O may be bought before phase 3, for up to $40.
        if (
            asset.privateCompanyId === KcmoId &&
            requireStateMex(state).options.earlyKcmo &&
            !PhasesMex.isAtLeast(state.phaseId, '3')
        )
            return { minimum: 20, maximum: 40 }
        // From the first 3-train, for half to one and a half times face value (4.3.5).
        return PhasesMex.isAtLeast(state.phaseId, '3')
            ? PrivateCatalogMex.priceRange(asset.privateCompanyId)
            : undefined
    },
    afterPurchase: () => {}
}

/**
 * A major owning the KCM&O may lay the Copper Canyon tile in F5 during its tile step, besides its
 * own lays and unconnected, for $60; the lay closes the KCM&O, and another tile there first ends
 * the ability (Table III; TR-7, TR-8).
 */
export const PrivatePowerRulesMex: PrivatePowerRules = {
    trackTerms(state, privateCompanyId, playerId) {
        if (privateCompanyId !== KcmoId || privatePowerUsed(state, KcmoId)) return undefined
        const owner = privateOwner(state, KcmoId)
        const companyId = EighteenXXTransferTiming.operatingCompany(state)
        if (
            owner?.kind !== 'company' ||
            owner.companyId !== companyId ||
            controllingOwner(state, companyId)?.playerId !== playerId ||
            state.machineState !== 'LayingTrack' ||
            state.trackStep?.companyId !== companyId ||
            state.trackStep.completed ||
            state.tileInventory.placements[CopperCanyonLocationId]
        )
            return undefined
        return {
            companyId,
            locationIds: [CopperCanyonLocationId],
            definitionIds: [CopperCanyonTileId],
            payer: owner,
            connected: false,
            terrainDiscount: 60
        }
    },
    afterTrackLay: () => ({ payments: [], closedPrivateIds: [KcmoId] }),
    earlyTrainCompany: () => undefined,
    betweenTurnsPrivateIds: []
}

/**
 * The president makes up a train the company cannot afford: the cheapest in the bank, selling
 * shares as needed but never so the operating company's presidency changes (4.3.4.2).
 */
export const TrainFundingRulesMex = presidentTrainFundingRules({
    repeatSales: 'separate',
    companyOrder: majorOrder,
    saleTerms: emergencySaleTermsMex,
    stockRules: StockRulesMex,
    protectsPresidency: (companyId, operatingCompanyId) => companyId === operatingCompanyId
})

export const BankruptcyReasonMex = 'A player is bankrupt'
export const MarketEndReasonMex = 'A company reached $200'

/** A $200 price ends the game after the current operating round, or the next after a stock round (6(b)). */
function marketEnding(state: EndingState): GameEnding | undefined {
    const reached = state.stockMarket.stacks.some(
        (stack) => MarketMex.space(stack.spaceId).price >= EndPrice && stack.companyIds.length > 0
    )
    if (!reached) return undefined
    const set = state.operatingSet
    if (!set || set.completed)
        return {
            reason: MarketEndReasonMex,
            finalOperatingSet: (set?.number ?? 0) + 1,
            finalOperatingRound: 1
        }
    return {
        reason: MarketEndReasonMex,
        finalOperatingSet: set.number,
        finalOperatingRound: set.roundNumber
    }
}

/** The ending that comes first. */
function earliest(endings: readonly (GameEnding | undefined)[]): GameEnding | undefined {
    const order = (ending: GameEnding) =>
        (ending.finalOperatingSet ?? Infinity) * 100 + (ending.finalOperatingRound ?? 99)
    return endings
        .filter((ending): ending is GameEnding => !!ending)
        .reduce<GameEnding | undefined>(
            (best, ending) => (!best || order(ending) < order(best) ? ending : best),
            undefined
        )
}

/**
 * A bankruptcy ends the game at once; a broken bank or a $200 price after the current operating
 * round, or one more after a stock round (6). Players score cash, stock at market value, and
 * privates and minors at par; stock of a company whose president's certificate is unsold, or
 * that is gone, counts nothing (6.1, 3.2(a)(2)).
 */
export const EndingRulesMex: EndingRules = {
    trigger(state) {
        if (state.bankruptcy) return { reason: BankruptcyReasonMex }
        return earliest([bankBrokenRoundEnding(state), marketEnding(state)])
    },
    certificateItems(state, certificate) {
        const company = getCompany(state, certificate.companyId)
        if (company.closed) return [certificateWealthItem(NamesMex, certificate, 0)]
        if (certificate.kind === 'private')
            return [
                certificateWealthItem(
                    NamesMex,
                    certificate,
                    PrivateCatalogMex.faceValue(company.id)
                )
            ]
        const minor = MinorsMex.find((entry) => entry.id === company.id)
        if (minor) return [certificateWealthItem(NamesMex, certificate, minor.faceValue)]
        if (certificate.kind !== 'share' || !company.started)
            return [certificateWealthItem(NamesMex, certificate, 0)]
        const price = MarketMex.companySpace(state.stockMarket, company.id).price
        const value =
            company.id === NdmId
                ? ndmUnitsValue(certificate.shares, price, 'up')
                : price * certificate.shares
        return [certificateWealthItem(NamesMex, certificate, value)]
    }
}
