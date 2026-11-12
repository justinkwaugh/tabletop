import { assertExists, type GameAction } from '@tabletop/common'
import {
    CompanyClosure,
    EighteenXXTransferTiming,
    StationReservation,
    bankExhaustionAtSetEnd,
    certificateShares,
    certificateWealthItem,
    closeShareCompany,
    dieselTrains,
    finiteCashOwnedBy,
    floatedCompaniesInMarketOrder,
    getCompany,
    marketDiscardOrder,
    marketShareValue,
    nextOperatingCompany,
    payOrWithholdEarningsRules,
    placeStockMarker,
    presidentTrainFundingRules,
    privateOwner,
    requiresStationRoute,
    CashPayment,
    settleCashPayments,
    sharesOwned,
    totalCertificateShares,
    trainsOwnedBy,
    treasuryPoolId,
    type Bankruptcy,
    type Certificate,
    type CorporateFinanceRules,
    type EarningsRules,
    type EndingRules,
    type EndingState,
    type FinanceChoice,
    type FinancialState,
    type FundingState,
    type HydratedEighteenXXState,
    type InsolvencyRules,
    type OperatingRules,
    type OperatingState,
    isAdvancePhase,
    type PhaseChangeState,
    type PhaseRules,
    type PrivateRules,
    type TrainFundingRules,
    type TrainPurchaseState,
    type TrainRules,
    type TransferRules,
    type WealthItem,
    type ZeroPriceClosureRules
} from '@tabletop/18xx'
import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { BondShareDeduction1849, repayBondOnClosure } from './bonds.js'
import { recordStationPurchase1849, stationPurchaseReason1849 } from './stationPurchase.js'
import { Charters1849, GaribaldiId, ShareCount1849 } from './companies.js'
import { Map1849, MessinaLocationId } from './map.js'
import { Names1849 } from './names.js'
import { PrivateCatalog1849, RealeSocietaPrivateId } from './privates.js'
import { RouteRules1849 } from './routes.js'
import { requireState1849, type HydratedState1849 } from './state.js'
import {
    MarketPoolId1849,
    StockRules1849,
    garibaldiWaiting1849,
    marketInForce1849,
    startOrder1849
} from './stock.js'
import {
    ClosedSpaceId1849,
    EndGameSpaceId1849,
    Market1849,
    parSpaceIds1849
} from './stockMarket.js'
import { TileSet1849 } from './tiles.js'
import {
    EarthquakePhaseId,
    ElectricTrainId,
    Phases1849,
    ReverseTrainId,
    TrainDepot1849
} from './trains.js'
import {
    ElectricPhaseId1849,
    electricDreamsInPlay,
    electricTrainReason1849
} from './electricDreams.js'

/** Corporations operate in market order: highest price, then rightmost, then top of a stack (§10). */
export const OperatingRules1849: OperatingRules = {
    charters: Charters1849,
    roundCount: (state) => Phases1849.phase(state.phaseId).operatingRounds,
    companyOrder: (state) => floatedCompaniesInMarketOrder(Market1849, state)
}

const PayOrWithhold = payOrWithholdEarningsRules(Market1849, Charters1849, {
    unpaidPoolIds: [MarketPoolId1849],
    companyPoolIds: []
})

// Treasury shares pay the corporation and pool shares pay no one (§10.5.3). A dividend of at
// least the price moves it right, a smaller one leaves it, and withholding or earning nothing
// moves it left (§10.5, §10.5.3).
export const EarningsRules1849: EarningsRules = {
    ...PayOrWithhold,
    marketEffect(state, companyId, distribution) {
        const company = getCompany(state, companyId)
        if (!company.floated) return { bonusPerShare: 0 }
        const market = marketInForce1849(state)
        const price = market.companySpace(state.stockMarket, companyId).price
        const paid = distribution.choice === 'pay' && distribution.revenue > 0
        if (paid && distribution.revenue < price) return { bonusPerShare: 0 }
        return { move: market.dividendMove(state.stockMarket, companyId, paid), bonusPerShare: 0 }
    }
}

export const LoanDeduction1849 = 750
export const LoanAmount1849 = 500

function loanCount(state: object, playerId: string): number {
    return requireState1849(state).loans.find((entry) => entry.playerId === playerId)?.count ?? 0
}

/** Whether a corporation that has reached L. 377 has finished an operating turn since (§13). */
function finishedAtTopPrice(state: EndingState): boolean {
    const top = Market1849.space(EndGameSpaceId1849).price
    return (
        state.machineState === 'OperatingSet' &&
        !!state.operatingSet?.completedCompanyIds.some((companyId) =>
            state.stockMarket.stacks.some(
                (stack) =>
                    stack.companyIds.includes(companyId) &&
                    Market1849.space(stack.spaceId).price >= top
            )
        )
    )
}

// The game ends after a corporation reaching L. 377 finishes operating, after the set of
// operating rounds in which the bank breaks, or with one player left (§13). Wealth is money and
// corporation stock, shares at market value and privates at nothing, less L. 750 a loan to no
// lower than nothing (§13).
/**
 * Whether play can no longer change: no corporation is open, every private has closed, and no
 * player has the cash for a president's certificate at the lowest start price. With nothing to
 * earn money, no one ever could, so the game ends there (ruling 15; §13 is silent).
 */
export function stalemate1849(stateObject: object): boolean {
    const state = requireState1849(stateObject)
    if (state.companies.some((company) => company.kind === 'private' && !company.closed))
        return false
    if (state.corporationOrder.some((companyId) => getCompany(state, companyId).started))
        return false
    const [presidentShares] = state.certificates.flatMap((certificate) =>
        certificate.kind === 'share' && certificate.president ? [certificate.shares] : []
    )
    assertExists(presidentShares, 'A corporation has a president’s certificate')
    const lowest = Math.min(
        ...parSpaceIds1849(state.phaseId).map((spaceId) => Market1849.space(spaceId).price)
    )
    return state.turnManager.turnOrder.every(
        (playerId) =>
            finiteCashOwnedBy(state, { kind: 'player', playerId }) < lowest * presidentShares
    )
}

export const EndingRules1849: EndingRules = {
    trigger(state) {
        if (state.turnManager.turnOrder.length <= 1) return { reason: 'One player left' }
        if (finishedAtTopPrice(state)) return { reason: 'L. 377 share price' }
        if (stalemate1849(state)) return { reason: 'No corporation can start' }
        return bankExhaustionAtSetEnd(state)
    },
    certificateItems(state, certificate) {
        const company = getCompany(state, certificate.companyId)
        // Each share of a corporation with an outstanding bond counts L. 100 less (§14.2).
        const value =
            company.closed || certificate.kind !== 'share'
                ? 0
                : Math.max(
                      0,
                      marketShareValue(Market1849, state, certificate) -
                          (company.loans ? BondShareDeduction1849 * certificate.shares : 0)
                  )
        return [certificateWealthItem(Names1849, certificate, value)]
    },
    playerItems(state, playerId, items) {
        const loans = loanCount(state, playerId)
        if (!loans) return []
        const total = items.reduce((sum, item) => sum + item.value, 0)
        const deduction: WealthItem = {
            assetId: `loans:${playerId}`,
            label: `${loans} bank loan${loans === 1 ? '' : 's'}`,
            value: -Math.min(loans * LoanDeduction1849, Math.max(0, total))
        }
        return [deduction]
    }
}

export const CorporationClosure1849 = Type.Object(
    {
        ...CompanyClosure.properties,
        restoredReservations: Type.Array(StationReservation),
        removedPortBonus: Type.Optional(Type.Literal(true)),
        /** The outstanding bond repaid as the corporation closed (§14.2). */
        bondRepayment: Type.Optional(Type.Array(CashPayment))
    },
    { additionalProperties: false }
)
export type CorporationClosure1849 = Type.Static<typeof CorporationClosure1849>

/**
 * Closes a corporation: its tokens, trains, shares and privates leave play without
 * compensation and its treasury goes to the bank. It may start again from the next stock round,
 * last in order, with a spot in its home city kept for it (§11).
 */
export function closeCorporation1849(
    stateObject: HydratedEighteenXXState,
    companyId: string
): CorporationClosure1849 {
    const state = requireState1849(stateObject)
    // An outstanding bond is repaid first (§14.2).
    const bondRepayment = repayBondOnClosure(state, companyId)
    const closure = closeShareCompany(state, companyId, 'removed', {
        poolId: treasuryPoolId(companyId),
        shareCount: ShareCount1849,
        keepsAllStations: true
    })
    const restoredReservations = Map1849.stationReservations().filter(
        (reservation) => reservation.companyId === companyId
    )
    state.stationReservations = [...state.stationReservations, ...restoredReservations]
    // It goes last, though ahead of a Garibaldi set aside for want of a home (§9.4.1).
    const order = startOrder1849(state).filter((id) => id !== companyId)
    const behind = order.at(-1) === GaribaldiId && garibaldiWaiting1849(state) ? 1 : 0
    state.corporationOrder = [
        ...order.slice(0, order.length - behind),
        companyId,
        ...order.slice(order.length - behind)
    ]
    state.restarts = [
        ...state.restarts.filter((entry) => entry.companyId !== companyId),
        { companyId, stockRound: state.stockRound.number + 1 }
    ]
    state.floats = state.floats.filter((entry) => entry.companyId !== companyId)
    // A restartable charter is not closed for good, so it leaves the round's order by hand,
    // unless it is operating now, when the closure ends its turn.
    const set = state.operatingSet
    const operating = nextOperatingCompany(state)
    if (set && operating !== companyId)
        set.companyOrder = set.companyOrder.filter(
            (id) => id !== companyId || set.completedCompanyIds.includes(id)
        )
    if (state.royalCompanyId === companyId) delete state.royalCompanyId
    if (state.royalFunding === companyId) delete state.royalFunding
    const removedPortBonus = state.portBonus?.companyId === companyId
    if (removedPortBonus) delete state.portBonus
    return {
        ...closure,
        restoredReservations,
        ...(removedPortBonus ? { removedPortBonus: true as const } : {}),
        ...(bondRepayment.length ? { bondRepayment } : {})
    }
}

/** A corporation whose price enters the Closed box closes at once (§5, §11). */
export const ZeroPriceClosure1849: ZeroPriceClosureRules<typeof CorporationClosure1849> = {
    market: Market1849,
    closure: { schema: CorporationClosure1849, close: closeCorporation1849 }
}

// A run from a city to a port alone is no route (§10.5.1).
const RequiresStationRoute1849 = requiresStationRoute(Map1849, TileSet1849, undefined, {
    minimumCitiesAndTowns: RouteRules1849.minimumCitiesAndTowns
})

/** Whether the bank has a train to sell, new or in its pool. */
function bankHasTrain(state: TrainPurchaseState): boolean {
    return (
        state.trainInventory.trains.some((train) => train.status === 'market') ||
        TrainRules1849.availableDefinitions(state).some(
            (definitionId) => TrainDepot1849.remaining(state.trainInventory, definitionId) !== 0
        )
    )
}

/**
 * A corporation with a route must own a train (§10.6), so long as the bank has one to sell: once
 * every train is sold it may only buy from another corporation.
 */
export const RequiresTrain1849: TrainRules['requiresTrain'] = (state, companyId) =>
    RequiresStationRoute1849(state, companyId) && bankHasTrain(state)

// Trains are bought from the bank in order, any number a turn; the R6H goes on sale beside the
// 16H once the first is bought (§10.6). The Reale Società d'Affari closes when its corporation
// buys its first train (§8.1).
// The R6H goes on sale with the first 16H, beside whatever comes next (§10.6).
const ReverseTrains1849 = dieselTrains({
    depot: TrainDepot1849,
    phases: Phases1849,
    dieselId: ReverseTrainId,
    fromPhaseId: '16H',
    tradeInIds: [],
    credit: 0
})

export const TrainRules1849: TrainRules = {
    depot: TrainDepot1849,
    requiresTrain: RequiresTrain1849,
    ...ReverseTrains1849,
    // With Electric Dreams, E trains are on sale too from the first 12H (§14.3).
    availableDefinitions(state) {
        const available = ReverseTrains1849.availableDefinitions?.(state) ?? []
        const electric =
            electricDreamsInPlay(state) &&
            Phases1849.isAtLeast(state.phaseId, ElectricPhaseId1849) &&
            TrainDepot1849.remaining(state.trainInventory, ElectricTrainId) !== 0
        return electric && !available.includes(ElectricTrainId)
            ? [...available, ElectricTrainId]
            : available
    },
    limitReason: (state, companyId, definitionId) =>
        electricTrainReason1849(state, companyId, definitionId),
    phaseAfterPurchase: (state, definitionId) =>
        Phases1849.phaseAfterPurchase(state.phaseId, definitionId),
    trainLimit: (state) => Phases1849.phase(state.phaseId).trainLimit,
    purchaseLimit: () => 'unlimited',
    privatesClosedByPurchase(state, companyId) {
        if (requireState1849(state).royalCompanyId !== companyId) return []
        return state.companies
            .filter((company) => company.id === RealeSocietaPrivateId && !company.closed)
            .map((company) => company.id)
    }
}

export const Earthquake1849 = Type.Object(
    {
        removedTile: Type.Optional(
            Type.Object(
                { pieceId: Type.String(), definitionId: Type.String() },
                { additionalProperties: false }
            )
        ),
        lostStationIds: Type.Array(Type.String()),
        closedCorporation: Type.Optional(CorporationClosure1849)
    },
    { additionalProperties: false }
)
export type Earthquake1849 = Type.Static<typeof Earthquake1849>
const EarthquakeValidator = Compile(Earthquake1849)

/** What the Messina earthquake did, as the phase change to the first 12H recorded it (§12). */
export function messinaEarthquakeOf(action: GameAction): Earthquake1849 | undefined {
    if (!isAdvancePhase(action) || action.metadata?.event.toPhaseId !== EarthquakePhaseId)
        return undefined
    const changes = action.metadata.changes
    return EarthquakeValidator.Check(changes) ? changes : undefined
}

/**
 * The Messina earthquake at the first 12H: the tile on Messina goes, its tokens are lost for
 * good, and it cannot be upgraded until after the next stock round. A Garibaldi with no other
 * station closes (§12).
 */
function messinaEarthquake(stateObject: PhaseChangeState): Earthquake1849 {
    const state = requireState1849(stateObject)
    const atMessina = state.stations.filter(
        (station) =>
            station.status === 'placed' && station.position.locationId === MessinaLocationId
    )
    const garibaldiPlaced = state.stations.filter(
        (station) => station.companyId === GaribaldiId && station.status === 'placed'
    )
    const closesGaribaldi =
        garibaldiPlaced.length === 1 &&
        atMessina.some((station) => station.companyId === GaribaldiId)
    // A Garibaldi buying the train itself closes as its turn's closure, from the Closed box.
    const garibaldiOperating = nextOperatingCompany(state) === GaribaldiId
    if (closesGaribaldi && garibaldiOperating)
        placeStockMarker(state.stockMarket, GaribaldiId, ClosedSpaceId1849)
    const closedCorporation =
        closesGaribaldi && !garibaldiOperating
            ? closeCorporation1849(state, GaribaldiId)
            : undefined
    const lostStationIds = atMessina
        .filter((station) => !closesGaribaldi || station.companyId !== GaribaldiId)
        .map((station) => station.id)
    state.stations = state.stations.map((station) =>
        lostStationIds.includes(station.id)
            ? { id: station.id, companyId: station.companyId, status: 'removed' }
            : station
    )
    const placement = state.tileInventory.placements[MessinaLocationId]
    if (placement) delete state.tileInventory.placements[MessinaLocationId]
    state.messinaLockedUntil = state.stockRound.number + 1
    return {
        ...(placement
            ? {
                  removedTile: {
                      pieceId: placement.pieceId,
                      definitionId: placement.definitionId
                  }
              }
            : {}),
        lostStationIds,
        ...(closedCorporation ? { closedCorporation } : {})
    }
}

// A corporation over a new train limit returns trains to the bank pool, and trains of an
// eliminated class leave at once (§6).
export const PhaseRules1849: PhaseRules = {
    rustTiming: (state, train) => Phases1849.rustTiming(state.phaseId, train.definitionId),
    discardOrder: (state, companyId) => marketDiscardOrder(Market1849, state, companyId),
    discardDestination: 'market',
    changes: {
        schema: Earthquake1849,
        apply: (state, event) =>
            event.toPhaseId === EarthquakePhaseId
                ? messinaEarthquake(state)
                : { lostStationIds: [] }
    }
}

export const PrivateRules1849: PrivateRules = {
    exchangeTerms: () => undefined,
    phaseEffects: (state) => PrivateCatalog1849.closureEffects(state),
    operationEffects: () => [],
    description: (_state, id) => PrivateCatalog1849.definition(id).description ?? '',
    blocking: PrivateCatalog1849.blocking.bind(PrivateCatalog1849)
}

// Trains change hands between corporations at any price of at least L. 1; from phase 6 to
// phase 10 a corporation buys a player's private, all but the Reale Società d'Affari, for L. 1
// to twice its value (§7.1, §10.2, §10.6).
export const TransferRules1849: TransferRules = {
    ...EighteenXXTransferTiming,
    charters: Charters1849,
    canPurchase(state, companyId, asset) {
        // The Buy station tokens variant (§14.1).
        if (asset.kind === 'station')
            return stationPurchaseReason1849(state, companyId, asset.stationId) === undefined
        return EighteenXXTransferTiming.canPurchase(state, companyId, asset)
    },
    priceRange(state, _companyId, asset) {
        // A station token goes for at least L. 1, as the two presidents agree (§14.1).
        if (asset.kind === 'train' || asset.kind === 'station') return { minimum: 1 }
        if (asset.kind !== 'private') return undefined
        if (
            !Phases1849.isAtLeast(state.phaseId, '6H') ||
            Phases1849.isAtLeast(state.phaseId, EarthquakePhaseId) ||
            privateOwner(state, asset.privateCompanyId)?.kind !== 'player'
        )
            return undefined
        return PrivateCatalog1849.priceRange(asset.privateCompanyId)
    },
    afterPurchase(state, offer) {
        if (offer.asset.kind === 'station') recordStationPurchase1849(state, offer.buyer.companyId)
    }
}

export const InsolvencyChoices1849 = { loan: 'loan', leave: 'leave' } as const

export const Insolvency1849 = Type.Object(
    {
        closure: CorporationClosure1849,
        loan: Type.Optional(Type.Literal(true)),
        left: Type.Optional(Type.Literal(true))
    },
    { additionalProperties: false }
)
export type Insolvency1849 = Type.Static<typeof Insolvency1849>

/** Whether the president owns no shares but those of the corporation failing (§10.7). */
function leftWithoutStock(state: FinancialState, bankruptcy: Bankruptcy): boolean {
    const president = { kind: 'player' as const, playerId: bankruptcy.playerId }
    return state.companies.every(
        (company) =>
            company.id === bankruptcy.companyId ||
            company.kind !== 'major' ||
            sharesOwned(state, company.id, president) === 0
    )
}

/**
 * A corporation that cannot buy its train closes, its president's money gone with its treasury.
 * A president left without stock takes a L. 500 bank loan or leaves the game (§10.7).
 */
export const InsolvencyRules1849: InsolvencyRules<typeof Insolvency1849> = {
    schema: Insolvency1849,
    choices: (state, bankruptcy) =>
        leftWithoutStock(state, bankruptcy)
            ? [InsolvencyChoices1849.loan, InsolvencyChoices1849.leave]
            : [],
    fail(stateObject: FundingState & OperatingState, bankruptcy, choice) {
        const state = requireState1849(stateObject)
        const closure = closeCorporation1849(state, bankruptcy.companyId)
        if (choice === InsolvencyChoices1849.loan) {
            const player = { kind: 'player' as const, playerId: bankruptcy.playerId }
            settleCashPayments(state, [
                { from: { kind: 'bank' }, to: player, amount: LoanAmount1849 }
            ])
            state.loans = [
                ...state.loans.filter((entry) => entry.playerId !== bankruptcy.playerId),
                { playerId: bankruptcy.playerId, count: loanCount(state, bankruptcy.playerId) + 1 }
            ]
            return { closure, loan: true }
        }
        if (choice === InsolvencyChoices1849.leave) {
            state.bankruptPlayerIds = [...(state.bankruptPlayerIds ?? []), bankruptcy.playerId]
            state.turnManager.turnOrder = state.turnManager.turnOrder.filter(
                (id) => id !== bankruptcy.playerId
            )
            state.stockRound.passedPlayerIds = state.stockRound.passedPlayerIds.filter(
                (id) => id !== bankruptcy.playerId
            )
            return { closure, left: true }
        }
        return { closure }
    }
}

// A president funds a train from their own money and then their shares, never giving up the
// presidency of the corporation buying, and must buy the cheapest train from the bank (§10.7).
export const TrainFundingRules1849: TrainFundingRules = {
    ...presidentTrainFundingRules({
        companyOrder: OperatingRules1849.companyOrder,
        saleTerms: StockRules1849.saleTerms,
        stockRules: StockRules1849,
        protectsPresidency: (companyId, operatingCompanyId) => companyId === operatingCompanyId
    }),
    insolvency: InsolvencyRules1849
}

/** Single-share certificates first, the last certificate after them (§9.6). */
function lastCertificateLast(certificates: readonly Certificate[]): Certificate[] {
    return certificates.toSorted((a, b) => certificateShares(a) - certificateShares(b))
}

function companyCertificatesIn(state: FinancialState, companyId: string, poolId: string) {
    return lastCertificateLast(
        state.certificates.filter(
            (certificate) =>
                certificate.kind === 'share' &&
                certificate.companyId === companyId &&
                certificate.poolId === poolId
        )
    )
}

/** Whether the corporation is in the operating round it floated for, its first (§10.8). */
function inFirstOperatingRound(state: HydratedState1849, companyId: string): boolean {
    const floated = state.floats.find((entry) => entry.companyId === companyId)
    return (
        !!floated &&
        state.operatingSet?.number === floated.stockRound &&
        state.operatingSet.roundNumber === 1
    )
}

/**
 * After buying trains a corporation may issue treasury certificates, not in its first operating
 * round, each share dropping its price a row; or redeem one from the pool. The last certificate
 * goes only after the others; nothing more follows either (§9.6, §10.8).
 */
export const CorporateFinanceRules1849: CorporateFinanceRules = {
    timing: 'after-trains',
    certificates: (state, companyId, operation) =>
        companyCertificatesIn(
            state,
            companyId,
            operation === 'issue' ? treasuryPoolId(companyId) : MarketPoolId1849
        ),
    destinationPool: (companyId, operation) =>
        operation === 'issue' ? MarketPoolId1849 : treasuryPoolId(companyId),
    choices(stateObject, companyId, committed): FinanceChoice[] {
        const state = requireState1849(stateObject)
        if (committed) return []
        const treasury = { kind: 'company' as const, companyId }
        if (!trainsOwnedBy(state, treasury).length && RequiresTrain1849(state, companyId)) return []
        const price = Market1849.companySpace(state.stockMarket, companyId).price
        const pool = companyCertificatesIn(state, companyId, MarketPoolId1849)
        const poolShares = totalCertificateShares(pool)
        const issues: FinanceChoice[] = []
        if (!inFirstOperatingRound(state, companyId)) {
            const held = companyCertificatesIn(state, companyId, treasuryPoolId(companyId))
            let shares = 0
            for (const certificate of held) {
                shares += certificateShares(certificate)
                if (poolShares + shares > ShareCount1849 / 2) break
                issues.push({ companyId, operation: 'issue', shares, amount: shares * price })
            }
        }
        const [redeemed] = pool
        const redeemShares = redeemed ? certificateShares(redeemed) : 0
        const redeem: FinanceChoice[] =
            redeemShares && finiteCashOwnedBy(state, treasury) >= redeemShares * price
                ? [
                      {
                          companyId,
                          operation: 'redeem',
                          shares: redeemShares,
                          amount: redeemShares * price
                      }
                  ]
                : []
        return [...issues, ...redeem]
    },
    afterSettling(state, choice) {
        if (choice.operation !== 'issue') return
        Market1849.moveCompanyMarker(state.stockMarket, choice.companyId, 'down', choice.shares)
    }
}
