import {
    CompanyClosure,
    closeShareCompany,
    marketDiscardOrder,
    marketDividendEarnings,
    marketValueEnding,
    getCompany,
    privateOwner,
    EighteenXXTransferTiming,
    RailwayMapState,
    fullCapitalizationCompanyRules,
    type CompanyRules,
    type EarningsRules,
    type HydratedEighteenXXState,
    type PhaseRules,
    type PrivatePowerRules,
    type PrivateRules,
    type TransferRules,
    type ZeroPriceClosureRules
} from '@tabletop/18xx'
import * as Type from 'typebox'
import { Charters1870, FriscoCompanyId, RiverCompanyIds, company1870 } from './companies.js'
import { Names1870 } from './names.js'
import { BridgePrivateId, PrivateCatalog1870, privateDescription } from './privates.js'
import { Map1870, RiverLocationIds } from './map.js'
import { requireState1870 } from './state.js'
import { Market1870 } from './stockMarket.js'
import { TileSet1870 } from './tiles.js'
import { revenueTokensExpire } from './tokens.js'
import { DieselVariant1870, Phases1870 } from './trains.js'
import { RevenueToken } from './titleState.js'

// A half dividend leaves the company half the earnings, rounded up to the nearest $10 (p. 20).
const Dividends = marketDividendEarnings({
    market: Market1870,
    charters: Charters1870,
    halfRetained: (revenue, count) => Math.ceil(revenue / 2 / count) * count
})

export const EarningsRules1870: EarningsRules = {
    ...Dividends,
    // A connection run's income is paid or withheld, never halved (p. 22).
    choices: (state, companyId) =>
        requireState1870(state).destinationRun
            ? ['pay', 'withhold']
            : Dividends.choices(state, companyId),
    // A withheld connection run stays where it is (p. 22).
    marketEffect(state, companyId, distribution) {
        const paid = distribution.revenue > distribution.retained
        if (!paid && requireState1870(state).destinationRun) return { bonusPerShare: 0 }
        return Dividends.marketEffect(state, companyId, distribution)
    }
}

// Bankruptcy ends the game at once, once presidents have decided on the shares it sold (p. 25's
// example); a broken bank after the set of operating rounds (pp. 22-23); with the $400 finish, a
// company reaching $400 once it finishes operating, or at once at the end of a stock round (p. 24).
// Shares count at market value and privates at the price printed on them (p. 24).
export const EndingRules1870 = marketValueEnding({
    market: Market1870,
    names: Names1870,
    privateFaceValue: (id) => PrivateCatalog1870.faceValue(id),
    bankruptcySettled: (state) => !requireState1870(state).priceProtection,
    finishPrice: {
        price: 400,
        active: (state) => !!requireState1870(state).variants.finish400,
        reason: '$400 share price'
    }
})

const ClosureFields = Type.Object(
    {
        ...CompanyClosure.properties,
        removedRevenueTokens: Type.Optional(Type.Array(RevenueToken))
    },
    { additionalProperties: false }
)

/** A closing company's tokens and stations leave the map, its trains go to the market (p. 7). */
export const ZeroPriceClosure1870: ZeroPriceClosureRules<typeof ClosureFields> = {
    market: Market1870,
    closure: {
        schema: ClosureFields,
        close(state: HydratedEighteenXXState, companyId) {
            const title = requireState1870(state)
            const closure = closeShareCompany(state, companyId, 'market')
            const removed = title.revenueTokens.filter((token) => token.companyId === companyId)
            title.revenueTokens = title.revenueTokens.filter(
                (token) => token.companyId !== companyId
            )
            return { ...closure, ...(removed.length ? { removedRevenueTokens: removed } : {}) }
        }
    }
}

export const PhaseRules1870: PhaseRules = {
    rustTiming: DieselVariant1870.rustTiming,
    discardOrder: (state, companyId) => marketDiscardOrder(Market1870, state, companyId),
    discardDestination: 'market',
    changes: {
        schema: Type.Object(
            { removedRevenueTokens: Type.Array(RevenueToken) },
            { additionalProperties: false }
        ),
        apply(state) {
            const title = requireState1870(state)
            if (!revenueTokensExpire(state.phaseId) || !title.revenueTokens.length)
                return { removedRevenueTokens: [] }
            const removedRevenueTokens = title.revenueTokens
            title.revenueTokens = []
            return { removedRevenueTokens }
        }
    }
}

export const PrivateRules1870: PrivateRules = {
    exchangeTerms: () => undefined,
    // Every private closes when the first 5-train is bought; the tokens stay until the first 6-train (p. 5).
    phaseEffects: (state) => PrivateCatalog1870.closureEffects(state),
    operationEffects: () => [],
    description: (_state, id) => privateDescription(id)
}

// A company buys a player's private from the first 3-train for half to double its price; before it only the
// Missouri Pacific or St. Louis Southwestern, and only the bridge, for $20 to $40 (pp. 18, 9).
const BridgeEarlyPrice = { minimum: 20, maximum: 40 }

export const TransferRules1870: TransferRules = {
    ...EighteenXXTransferTiming,
    charters: Charters1870,
    afterPurchase: () => undefined,
    priceRange(state, companyId, asset) {
        if (requireState1870(state).destinationRun) return undefined
        if (asset.kind === 'train') return { minimum: 1 }
        if (asset.kind !== 'private') return undefined
        const { privateCompanyId } = asset
        if (
            privateOwner(state, privateCompanyId)?.kind !== 'player' ||
            Phases1870.isAtLeast(state.phaseId, '5')
        )
            return undefined
        if (Phases1870.isAtLeast(state.phaseId, '3'))
            return PrivateCatalog1870.priceRange(privateCompanyId)
        return privateCompanyId === BridgePrivateId && RiverCompanyIds.includes(companyId)
            ? BridgeEarlyPrice
            : undefined
    }
}

const BridgeDiscount = 40
const YellowTileIds = [
    '1',
    '2',
    '3',
    '4',
    '5',
    '6',
    '7',
    '8',
    '9',
    '55',
    '56',
    '57',
    '58',
    '69'
].map((number) => `18xx:${number}`)

/**
 * The company owning the bridge may build one river hex for $40 less, or, a river company buying it
 * in its first operating round, lay a tile on its open starting city free. Either is besides its
 * ordinary lays, and that tile cannot be upgraded the same operating round (p. 9).
 */
export const PrivatePowerRules1870: PrivatePowerRules = {
    earlyTrainCompany: () => undefined,
    trackTerms(state, privateCompanyId, playerId) {
        if (privateCompanyId !== BridgePrivateId) return undefined
        const companyId = state.trackStep?.companyId
        if (
            !companyId ||
            state.machineState !== 'LayingTrack' ||
            !state.activePlayerIds.includes(playerId)
        )
            return undefined
        const owner = privateOwner(state, BridgePrivateId)
        if (owner?.kind !== 'company' || owner.companyId !== companyId) return undefined
        const company = getCompany(state, companyId)
        const home = company1870(companyId)?.home
        if (
            home &&
            RiverCompanyIds.includes(companyId) &&
            !company.operated &&
            !new RailwayMapState(Map1870, TileSet1870, state.tileInventory).tile(home).placement
        )
            return {
                companyId,
                locationIds: [home],
                definitionIds: YellowTileIds,
                payer: owner,
                connected: true,
                free: true
            }
        return {
            companyId,
            locationIds: RiverLocationIds,
            definitionIds: YellowTileIds,
            payer: owner,
            connected: true,
            terrainDiscount: BridgeDiscount
        }
    },
    afterTrackLay(state, privateCompanyId, details) {
        if (privateCompanyId === BridgePrivateId)
            requireState1870(state).bridgeLayLocationId = details.locationId
        return { payments: [], closedPrivateIds: [] }
    }
}

const fullCapital = (floatPercent: number) =>
    fullCapitalizationCompanyRules({
        market: Market1870,
        charters: Charters1870,
        ipoPoolId: 'initial-offering',
        parSpaceColor: 'pink',
        floatPercent
    })
const Ordinary = fullCapital(60)
const Frisco = fullCapital(20)
const rulesFor = (companyId: string) => (companyId === FriscoCompanyId ? Frisco : Ordinary)

// A company floats with six shares sold, the Frisco with its president's certificate, and receives
// ten times par (p. 15).
export const CompanyRules1870: CompanyRules = {
    ...Ordinary,
    sharesToFloat: (state, companyId) => rulesFor(companyId).sharesToFloat?.(state, companyId),
    flotationPayments: (state, companyId) =>
        rulesFor(companyId).flotationPayments(state, companyId),
    parAfterAward: true
}
