import {
    ActionSource,
    assert,
    assertExists,
    turnOrderFrom,
    type HydratedAction,
    type MachineContext
} from '@tabletop/common'
import {
    CashPayment,
    addCompanyStations,
    controllingOwner,
    finiteCashOwnedBy,
    getCompany,
    isFinishStockTurn,
    markTurnPurchase,
    mustSellShares,
    placeStockMarker,
    recordStockAction,
    recordStockRoundSale,
    removeCertificates,
    removeStockMarker,
    replaceStation,
    settleCashPayments,
    signedShares,
    soldThisStockRound,
    systemAction,
    titleAction,
    trainsOwnedBy,
    transferCompanyAssets,
    type Owner,
    type PlacedStation,
    type StockMarketSpace
} from '@tabletop/18xx'
import * as Type from 'typebox'
import { CoalRightId } from './coal.js'
import { IpoPoolId1828, MarketPoolId1828 } from './names.js'
import type { HydratedState1828, Merger1828, StateHandler1828 } from './state.js'
import { StockRules1828 } from './stock.js'
import { Market1828, stockPrice } from './stockMarket.js'
import { isSystem, systemAbsorbing } from './systems.js'

const Id = Type.String({ minLength: 1 })
const player = (playerId: string) => ({ kind: 'player' as const, playerId })

/** A system's ten shares, its director holding at least the 20% certificate (§7.5, §13.3.3). */
const SystemShares = 10
/** The 20% certificate and the share donated to the system (§7.5.2.2). */
const SharesToDirectSystem = 3
/** Two pairs and a single traded up: the fewest shares that can reach three system shares. */
const SharesForThreeSystemShares = 5

/**
 * The system's price: up the column of the leftmost of the two prices, then right along the
 * top row, the largest value not above the larger price plus half the smaller (§7.5.2 step 2).
 */
export function systemMarketSpace(
    first: StockMarketSpace,
    second: StockMarketSpace
): StockMarketSpace {
    const leftmost =
        first.column < second.column || (first.column === second.column && first.row > second.row)
            ? first
            : second
    const [smaller, larger] = [first.price, second.price].sort((a, b) => a - b)
    const target = larger + Math.floor(smaller / 2)
    const column = Market1828.spaces
        .filter((space) => space.column === leftmost.column && space.row <= leftmost.row)
        .sort((a, b) => b.row - a.row)
    const top = Market1828.spaces
        .filter((space) => space.row === 0 && space.column > leftmost.column)
        .sort((a, b) => a.column - b.column)
    const path = [...column, ...top]
    return path.filter((space) => space.price <= target).at(-1) ?? leftmost
}

/** Whether the company floated in the stock round under way (§7.5.1). */
function floatedThisRound(state: HydratedState1828, companyId: string): boolean {
    return (
        !!getCompany(state, companyId).floated && !!state.floatedThisStockRound?.includes(companyId)
    )
}

function floatedEarlier(state: HydratedState1828, companyId: string): boolean {
    return !!getCompany(state, companyId).floated && !floatedThisRound(state, companyId)
}

/** Each player's shares by company, a director's certificate counting two, tallied once. */
type ShareCounts = ReadonlyMap<string, ReadonlyMap<string, number>>

function shareCounts(state: HydratedState1828): ShareCounts {
    const counts = new Map<string, Map<string, number>>()
    for (const certificate of state.certificates) {
        if (certificate.owner.kind !== 'player') continue
        const held = counts.get(certificate.owner.playerId) ?? new Map<string, number>()
        held.set(
            certificate.companyId,
            (held.get(certificate.companyId) ?? 0) + signedShares(certificate)
        )
        counts.set(certificate.owner.playerId, held)
    }
    return counts
}

const heldShares = (counts: ShareCounts, playerId: string, companyId: string) =>
    counts.get(playerId)?.get(companyId) ?? 0

function soldEither(state: HydratedState1828, playerId: string, companyIds: readonly string[]) {
    return companyIds.some((companyId) =>
        soldThisStockRound(state.stockRound, player(playerId), companyId)
    )
}

type MergeableCompany = {
    id: string
    directorId?: string
    floatedEarlier: boolean
    floatedNow: boolean
}

/** The public companies open to a merger: parred, and neither a system nor merged (§7.5.1). */
function mergeableCompanies(state: HydratedState1828): MergeableCompany[] {
    return state.companies
        .filter(
            (company) =>
                company.kind === 'major' &&
                company.started &&
                !company.closed &&
                !isSystem(state, company.id) &&
                !systemAbsorbing(state, company.id)
        )
        .map(({ id }) => ({
            id,
            directorId: controllingOwner(state, id)?.playerId,
            floatedEarlier: floatedEarlier(state, id),
            floatedNow: floatedThisRound(state, id)
        }))
}

/**
 * Whether two companies may merge (§7.5.1): both floated in an earlier stock round, or neither
 * did and one floated in this one; and some player holds the five shares that three system shares
 * take at the least.
 */
function pairMayMerge(
    state: HydratedState1828,
    first: MergeableCompany,
    second: MergeableCompany,
    counts: ShareCounts
): boolean {
    const earlier = Number(first.floatedEarlier) + Number(second.floatedEarlier)
    if (!(earlier === 2 || (earlier === 0 && (first.floatedNow || second.floatedNow)))) return false
    return state.players.some(
        ({ playerId }) =>
            heldShares(counts, playerId, first.id) + heldShares(counts, playerId, second.id) >=
            SharesForThreeSystemShares
    )
}

export const withDecision = (
    merger: Merger1828,
    playerId: string,
    tradeUp: boolean
): Merger1828 => ({
    ...merger,
    decisions: [...merger.decisions, { playerId, tradeUp }]
})

export const withSetAside = (
    merger: Merger1828,
    playerId: string,
    companyId: string
): Merger1828 => ({
    ...merger,
    setAsides: [...merger.setAsides, { playerId, companyId }]
})

/** The acting player: a merger takes up their stock turn (§7.5.2). */
export function mergerProposerId(state: HydratedState1828): string {
    const playerId = state.turnManager.currentTurn()?.playerId
    assertExists(playerId, 'A merger belongs to the stock turn under way')
    return playerId
}

export function newMerger(survivorId: string, absorbedId: string): Merger1828 {
    return {
        survivorId,
        absorbedId,
        stage: 'shares',
        blockedStationIds: [],
        setAsides: [],
        decisions: []
    }
}

function mergerUnderWay(state: HydratedState1828): Merger1828 {
    const merger = state.merger
    assertExists(merger, 'A merger is under way')
    return merger
}

type MergerHolding = { playerId: string; survivor: number; absorbed: number }

/** Each player's shares of the two companies, in turn order from the acting player. */
function mergerHoldings(
    state: HydratedState1828,
    merger: Merger1828,
    counts: ShareCounts = shareCounts(state)
): MergerHolding[] {
    return turnOrderFrom(state.turnManager.turnOrder, mergerProposerId(state)).map((playerId) => ({
        playerId,
        survivor: heldShares(counts, playerId, merger.survivorId),
        absorbed: heldShares(counts, playerId, merger.absorbedId)
    }))
}

const pairsHeld = ({ survivor, absorbed }: MergerHolding) => Math.floor((survivor + absorbed) / 2)
const holdsSingle = ({ survivor, absorbed }: MergerHolding) => (survivor + absorbed) % 2 === 1

/**
 * Whether the holder has still to choose which single share to set aside: an odd total holding
 * both companies, where the two are priced differently and so the choice matters (§7.5.2 step 4).
 */
function choosesSetAside(
    state: HydratedState1828,
    merger: Merger1828,
    holding: MergerHolding
): boolean {
    return (
        stockPrice(state, merger.survivorId) !== stockPrice(state, merger.absorbedId) &&
        holdsSingle(holding) &&
        holding.survivor > 0 &&
        holding.absorbed > 0 &&
        !merger.setAsides.some((setAside) => setAside.playerId === holding.playerId)
    )
}

/** The next player to choose which single share to set aside. */
export function pendingSetAside(state: HydratedState1828, merger: Merger1828): string | undefined {
    return mergerHoldings(state, merger).find((holding) => choosesSetAside(state, merger, holding))
        ?.playerId
}

/**
 * The mergers the rules let the player start on their stock turn: they direct at least one of the
 * companies (§7.5.1). One may still fail once its shares are traded (§7.5.2.2).
 */
export function mergerChoices(
    state: HydratedState1828,
    playerId: string,
    counts: ShareCounts = shareCounts(state)
): { survivorId: string; absorbedId: string }[] {
    if (
        state.machineState !== 'StockRound' ||
        state.merger ||
        state.stockRound.completed ||
        state.activePlayerIds[0] !== playerId ||
        state.stockRound.turn.bought
    )
        return []
    const companies = mergeableCompanies(state)
    return companies.flatMap((first) =>
        companies.flatMap((second) =>
            first.id !== second.id &&
            (first.directorId === playerId || second.directorId === playerId) &&
            pairMayMerge(state, first, second, counts)
                ? [{ survivorId: first.id, absorbedId: second.id }]
                : []
        )
    )
}

/**
 * Whether the players' remaining choices can form the system, which takes one player ending with
 * three system shares (§7.5.2.2). Short of three pairs, that is a player with exactly two pairs
 * and a single trading it up, and every other single being sold leaves the most system shares for
 * it. Their dearest single costs them least. Other players' set-asides matter only through a swap,
 * whose cost exceeds the trade-up's only when the absorbed company is priced above the system; only
 * then are they tried, at most one choice for each of the other four players.
 */
export function mergerCanSucceed(
    state: HydratedState1828,
    merger: Merger1828,
    counts: ShareCounts = shareCounts(state)
): boolean {
    const holdings = mergerHoldings(state, merger, counts)
    if (holdings.some((holding) => pairsHeld(holding) >= SharesToDirectSystem)) return true
    const unpaired = holdings.reduce((left, holding) => left - pairsHeld(holding), SystemShares)
    if (unpaired <= 0) return false
    const companyIds = [merger.survivorId, merger.absorbedId]
    const contenders = holdings.filter(
        (holding) =>
            oneTradeFromDirecting(holding) &&
            decisionOf(merger, holding.playerId)?.tradeUp !== false &&
            !soldEither(state, holding.playerId, companyIds)
    )
    if (!contenders.length) return false
    const systemPrice = mergerSystemSpace(state, merger).price
    const setAsideOf = setAsideShares(state, merger, holdings)
    const someoneCanPay = contenders.some(({ playerId }) => {
        const companyId = setAsideOf.get(playerId)
        return (
            !!companyId &&
            finiteCashOwnedBy(state, player(playerId)) >= systemPrice - stockPrice(state, companyId)
        )
    })
    if (!someoneCanPay) return false
    if (singleCompletes(state, merger, holdings, systemPrice, unpaired)) return true
    if (stockPrice(state, merger.absorbedId) <= systemPrice) return false
    return holdings
        .filter((holding) => choosesSetAside(state, merger, holding))
        .reduce(
            (outcomes, { playerId }) =>
                outcomes.flatMap((outcome) =>
                    companyIds.map((companyId) => withSetAside(outcome, playerId, companyId))
                ),
            [merger]
        )
        .some((outcome) => singleCompletes(state, outcome, holdings, systemPrice, unpaired))
}

function oneTradeFromDirecting(holding: MergerHolding): boolean {
    return holdsSingle(holding) && pairsHeld(holding) === SharesToDirectSystem - 1
}

const decisionOf = (merger: Merger1828, playerId: string) =>
    merger.decisions.find((decision) => decision.playerId === playerId)

/** Whether, these set-asides made, a trade-up can give some player three system shares. */
function singleCompletes(
    state: HydratedState1828,
    merger: Merger1828,
    holdings: readonly MergerHolding[],
    systemPrice: number,
    unpaired: number
): boolean {
    const setAsideOf = setAsideShares(state, merger, holdings)
    const swapped = swappedSetAsides(merger, holdings, setAsideOf)
    let remaining = unpaired
    for (const holding of singleTradingOrder(holdings)) {
        const single = setAsideSingle(holding, setAsideOf)
        if (!single) continue
        if (!canTradeUp(state, merger, single, swapped, systemPrice, remaining)) continue
        const decision = decisionOf(merger, holding.playerId)
        if (oneTradeFromDirecting(holding) && decision?.tradeUp !== false) return true
        if (decision?.tradeUp) remaining--
    }
    return false
}

/** The mergers worth offering the player: those the rules allow that can succeed. */
export function offeredMergers(
    state: HydratedState1828,
    playerId: string
): { survivorId: string; absorbedId: string }[] {
    const counts = shareCounts(state)
    return mergerChoices(state, playerId, counts).filter(({ survivorId, absorbedId }) =>
        mergerCanSucceed(state, newMerger(survivorId, absorbedId), counts)
    )
}

function offersMerger(state: HydratedState1828, playerId: string): boolean {
    const counts = shareCounts(state)
    return mergerChoices(state, playerId, counts).some(({ survivorId, absorbedId }) =>
        mergerCanSucceed(state, newMerger(survivorId, absorbedId), counts)
    )
}

function consentPlayerId(state: HydratedState1828, merger: Merger1828): string | undefined {
    const directors = [merger.survivorId, merger.absorbedId].map(
        (id) => controllingOwner(state, id)?.playerId
    )
    return directors.find((id) => id && id !== mergerProposerId(state))
}

/** Hexes where both companies have a station: one becomes a blocking station (§7.5.2 step 3). */
function sharedHexes(
    state: HydratedState1828,
    merger: Pick<Merger1828, 'survivorId' | 'absorbedId'>
): { locationId: string; stations: PlacedStation[] }[] {
    const placed = (companyId: string) =>
        state.stations.filter(
            (station): station is PlacedStation =>
                station.companyId === companyId && station.status === 'placed'
        )
    const survivor = placed(merger.survivorId)
    const absorbed = placed(merger.absorbedId)
    return [...new Set(survivor.map((station) => station.position.locationId))]
        .filter((locationId) =>
            absorbed.some((station) => station.position.locationId === locationId)
        )
        .map((locationId) => ({
            locationId,
            stations: [...survivor, ...absorbed].filter(
                (station) => station.position.locationId === locationId
            )
        }))
}

/**
 * The shared hexes the acting player still chooses for: those whose two stations stand in
 * different cities. In one city the two are alike, and the absorbed company's gives way.
 */
export function pendingStationChoices(state: HydratedState1828, merger: Merger1828) {
    return sharedHexes(state, merger).filter(
        ({ stations }) =>
            new Set(stations.map((station) => station.position.nodeId)).size > 1 &&
            !stations.some((station) => merger.blockedStationIds.includes(station.id))
    )
}

type SingleTrade = {
    playerId: string
    companyId: string
    price: number
    tradeUp: boolean
    /** Whether the player chose, rather than having no system share to trade up to. */
    chosen: boolean
}

/** The share trading of a merger, by counts of shares (§7.5.2 steps 4–6, §7.5.2.1). */
export type MergerTrading = {
    systemPrice: number
    marketSpaceId: string
    pairs: Record<string, number>
    singles: SingleTrade[]
    /** The player whose single share is still to be decided: trade it up, or sell it. */
    deciderId?: string
    poolShares: number
    ipoShares: number
}

export function bankPoolShares(
    state: HydratedState1828,
    companyId: string,
    poolId: string
): number {
    return state.certificates.reduce(
        (sum, certificate) =>
            certificate.kind === 'share' &&
            certificate.companyId === companyId &&
            certificate.owner.kind === 'bank' &&
            certificate.poolId === poolId
                ? sum + certificate.shares
                : sum,
        0
    )
}

/**
 * The players whose set-aside survivor share another must take while trading pairs, once the
 * shares discarded and the other players' untraded ones run out (§7.5.2.1 items 1-3).
 */
function swappedSetAsides(
    merger: Merger1828,
    holdings: readonly MergerHolding[],
    setAsideOf: ReadonlyMap<string, string>
): Set<string> {
    const { survivorId, absorbedId } = merger
    const order = holdings.map(({ playerId }) => playerId)
    const counted = (companyId: string, heldOf: (holding: MergerHolding) => number) =>
        new Map(
            holdings.map((holding) => [
                holding.playerId,
                heldOf(holding) - (setAsideOf.get(holding.playerId) === companyId ? 1 : 0)
            ])
        )
    const survivors = counted(survivorId, ({ survivor }) => survivor)
    const others = counted(absorbedId, ({ absorbed }) => absorbed)
    const swapped = new Set<string>()
    let discarded = 0
    order.forEach((playerId, index) => {
        const own = survivors.get(playerId) ?? 0
        const wanted = Math.floor((own + (others.get(playerId) ?? 0)) / 2)
        survivors.set(playerId, 0)
        discarded += Math.max(0, own - wanted)
        let needed = Math.max(0, wanted - own)
        const fromDiscards = Math.min(needed, discarded)
        discarded -= fromDiscards
        needed -= fromDiscards
        for (const otherId of order.slice(index + 1)) {
            const taken = Math.min(needed, survivors.get(otherId) ?? 0)
            survivors.set(otherId, (survivors.get(otherId) ?? 0) - taken)
            others.set(otherId, (others.get(otherId) ?? 0) + taken)
            needed -= taken
        }
        for (const otherId of order) {
            if (needed === 0) break
            if (otherId === playerId || swapped.has(otherId)) continue
            if (setAsideOf.get(otherId) !== survivorId) continue
            swapped.add(otherId)
            needed--
        }
    })
    return swapped
}

function mergerSystemSpace(state: HydratedState1828, merger: Merger1828): StockMarketSpace {
    return systemMarketSpace(
        Market1828.companySpace(state.stockMarket, merger.survivorId),
        Market1828.companySpace(state.stockMarket, merger.absorbedId)
    )
}

/** Each odd holder's single: as chosen, or until then the dearer of those they hold. */
function setAsideShares(
    state: HydratedState1828,
    merger: Merger1828,
    holdings: readonly MergerHolding[]
): Map<string, string> {
    const setAsideOf = new Map<string, string>()
    for (const holding of holdings) {
        if (!holdsSingle(holding)) continue
        const held = [
            ...(holding.survivor > 0 ? [merger.survivorId] : []),
            ...(holding.absorbed > 0 ? [merger.absorbedId] : [])
        ]
        setAsideOf.set(
            holding.playerId,
            merger.setAsides.find((setAside) => setAside.playerId === holding.playerId)
                ?.companyId ??
                held.reduce((best, id) =>
                    stockPrice(state, id) > stockPrice(state, best) ? id : best
                )
        )
    }
    return setAsideOf
}

/** Singles are settled from the player after the acting player round to the acting player. */
function singleTradingOrder(holdings: readonly MergerHolding[]): MergerHolding[] {
    return [...holdings.slice(1), holdings[0]]
}

type SetAsideSingle = { playerId: string; companyId: string }

function setAsideSingle(
    { playerId }: MergerHolding,
    setAsideOf: ReadonlyMap<string, string>
): SetAsideSingle | undefined {
    const companyId = setAsideOf.get(playerId)
    return companyId ? { playerId, companyId } : undefined
}

/** Whether a system share is left, the holder has sold neither company, and can pay. */
function canTradeUp(
    state: HydratedState1828,
    merger: Merger1828,
    { playerId, companyId }: SetAsideSingle,
    swapped: ReadonlySet<string>,
    systemPrice: number,
    remaining: number
): boolean {
    const price = stockPrice(state, companyId)
    const swapCost = swapped.has(playerId) ? stockPrice(state, merger.absorbedId) - price : 0
    return (
        remaining > 0 &&
        !soldEither(state, playerId, [merger.survivorId, merger.absorbedId]) &&
        finiteCashOwnedBy(state, player(playerId)) >= Math.max(systemPrice - price, swapCost)
    )
}

/**
 * Pairs of the two companies' shares become one system share each, from the acting player
 * round; then each single set aside, from the next player round to the acting player, is traded
 * up for the difference in price or sold at its price; then the bank pool's and the IPO's. Until
 * chosen, a single set aside is the holder's dearer one. A holder whose set-aside share was
 * swapped pays any rise in its value or must sell (§7.5.2.1 item 3); either way the rest of the
 * price difference comes out the same. Shares left over go to the bank pool.
 */
export function mergerTrading(state: HydratedState1828, merger: Merger1828): MergerTrading {
    const companyIds = [merger.survivorId, merger.absorbedId]
    const system = mergerSystemSpace(state, merger)
    const holdings = mergerHoldings(state, merger)
    let remaining = SystemShares
    const pairs: Record<string, number> = {}
    for (const holding of holdings) {
        pairs[holding.playerId] = pairsHeld(holding)
        remaining -= pairs[holding.playerId]
    }
    const singles: SingleTrade[] = []
    let deciderId: string | undefined
    const setAsideOf = setAsideShares(state, merger, holdings)
    const swapped = swappedSetAsides(merger, holdings, setAsideOf)
    for (const holding of singleTradingOrder(holdings)) {
        const single = setAsideSingle(holding, setAsideOf)
        if (!single) continue
        const { playerId, companyId } = single
        const possible = canTradeUp(state, merger, single, swapped, system.price, remaining)
        const decision = merger.decisions.find((entry) => entry.playerId === playerId)
        if (possible && !decision) {
            deciderId = playerId
            break
        }
        const tradeUp = possible && decision?.tradeUp === true
        if (tradeUp) remaining--
        singles.push({
            playerId,
            companyId,
            price: stockPrice(state, companyId),
            tradeUp,
            chosen: possible
        })
    }
    const bankTrade = (poolId: string) => {
        const held = companyIds.reduce((sum, id) => sum + bankPoolShares(state, id, poolId), 0)
        const traded = Math.min(remaining, Math.ceil(held / 2))
        remaining -= traded
        return traded
    }
    const poolShares = deciderId ? 0 : bankTrade(MarketPoolId1828)
    const ipoShares = deciderId ? 0 : bankTrade(IpoPoolId1828)
    return {
        systemPrice: system.price,
        marketSpaceId: system.id,
        pairs,
        singles,
        ...(deciderId ? { deciderId } : {}),
        poolShares: poolShares + (deciderId ? 0 : remaining),
        ipoShares
    }
}

export function playerShares(trading: MergerTrading): Record<string, number> {
    const shares = { ...trading.pairs }
    for (const single of trading.singles) if (single.tradeUp) shares[single.playerId]++
    return shares
}

/**
 * The director: the acting player unless another holds more, ties among others going to the
 * first from the acting player (§7.5.2 step 10, §13.3.3).
 */
function directorOf(order: readonly string[], shares: Record<string, number>): string {
    return order.reduce((best, id) => ((shares[id] ?? 0) > (shares[best] ?? 0) ? id : best))
}

/**
 * Who directs the system after the donation, or why the merger fails: no one with the 20%
 * certificate and a 10% share to give (§7.5.2.2).
 */
export function mergerDirector(
    state: HydratedState1828,
    merger: Merger1828,
    trading: MergerTrading
): { directorId: string; shares: Record<string, number> } | { failure: string } {
    const { turnOrder } = state.turnManager
    const order = turnOrderFrom(turnOrder, mergerProposerId(state))
    const shares = playerShares(trading)
    const director = directorOf(order, shares)
    if ((shares[director] ?? 0) < SharesToDirectSystem)
        return { failure: 'No player holds the director’s certificate and a share to donate.' }
    const after = { ...shares, [director]: shares[director] - 1 }
    return { directorId: directorOf(turnOrderFrom(turnOrder, director), after), shares: after }
}

const ProposeMergerAction = titleAction('ProposeMerger', { survivorId: Id, absorbedId: Id })
export const ProposeMerger = ProposeMergerAction.schema
export type ProposeMerger = Type.Static<typeof ProposeMerger>
export const isProposeMerger = ProposeMergerAction.is

/** The acting player names the two companies, the survivor's shares and marker kept (§7.5.2 1). */
class HydratedProposeMerger extends ProposeMergerAction.Base implements ProposeMerger {
    declare type: 'ProposeMerger'
    declare playerId: string
    declare survivorId: string
    declare absorbedId: string
    isValid(state: HydratedState1828): boolean {
        return (
            this.source === ActionSource.User &&
            mergerChoices(state, this.playerId).some(
                (choice) =>
                    choice.survivorId === this.survivorId && choice.absorbedId === this.absorbedId
            )
        )
    }
    apply(state: HydratedState1828): void {
        assert(this.isValid(state), 'These companies cannot merge now')
        const merger = newMerger(this.survivorId, this.absorbedId)
        merger.stage = consentPlayerId(state, merger) ? 'consent' : 'shares'
        state.merger = merger
    }
}

const AnswerMergerAction = titleAction('AnswerMerger', { accept: Type.Boolean() })
export const AnswerMerger = AnswerMergerAction.schema
export type AnswerMerger = Type.Static<typeof AnswerMerger>
export const isAnswerMerger = AnswerMergerAction.is

/** The other director agrees or refuses (§7.5.1). */
class HydratedAnswerMerger extends AnswerMergerAction.Base implements AnswerMerger {
    declare type: 'AnswerMerger'
    declare playerId: string
    declare accept: boolean
    isValid(state: HydratedState1828): boolean {
        const merger = state.merger
        return (
            this.source === ActionSource.User &&
            merger?.stage === 'consent' &&
            consentPlayerId(state, merger) === this.playerId
        )
    }
    apply(state: HydratedState1828): void {
        assert(this.isValid(state), 'No merger awaits this player’s answer')
        const merger = mergerUnderWay(state)
        if (!this.accept) {
            delete state.merger
            state.activePlayerIds = [mergerProposerId(state)]
            return
        }
        merger.stage = 'shares'
    }
}

const BlockMergerStationAction = titleAction('BlockMergerStation', { stationId: Id })
export const BlockMergerStation = BlockMergerStationAction.schema
export type BlockMergerStation = Type.Static<typeof BlockMergerStation>
export const isBlockMergerStation = BlockMergerStationAction.is

/**
 * In a hex where both companies have a station, the acting player chooses the one that becomes a
 * blocking station, its marker returning to the system's charter (§7.5.2 step 3).
 */
class HydratedBlockMergerStation
    extends BlockMergerStationAction.Base
    implements BlockMergerStation
{
    declare type: 'BlockMergerStation'
    declare playerId: string
    declare stationId: string
    isValid(state: HydratedState1828): boolean {
        const merger = state.merger
        return (
            this.source === ActionSource.User &&
            merger?.stage === 'shares' &&
            mergerProposerId(state) === this.playerId &&
            pendingStationChoices(state, merger).some(({ stations }) =>
                stations.some((station) => station.id === this.stationId)
            )
        )
    }
    apply(state: HydratedState1828): void {
        assert(this.isValid(state), 'This station cannot be chosen now')
        mergerUnderWay(state).blockedStationIds.push(this.stationId)
    }
}

const ChooseSetAsideShareAction = titleAction('ChooseSetAsideShare', { companyId: Id })
export const ChooseSetAsideShare = ChooseSetAsideShareAction.schema
export type ChooseSetAsideShare = Type.Static<typeof ChooseSetAsideShare>
export const isChooseSetAsideShare = ChooseSetAsideShareAction.is

/** A player with an odd total chooses the single share to set aside (§7.5.2 step 4). */
class HydratedChooseSetAsideShare
    extends ChooseSetAsideShareAction.Base
    implements ChooseSetAsideShare
{
    declare type: 'ChooseSetAsideShare'
    declare playerId: string
    declare companyId: string
    isValid(state: HydratedState1828): boolean {
        const merger = state.merger
        return (
            this.source === ActionSource.User &&
            !!merger &&
            mergerStep(state, merger) === 'set-aside' &&
            pendingSetAside(state, merger) === this.playerId &&
            [merger.survivorId, merger.absorbedId].includes(this.companyId)
        )
    }
    apply(state: HydratedState1828): void {
        assert(this.isValid(state), 'This share cannot be set aside now')
        mergerUnderWay(state).setAsides.push({
            playerId: this.playerId,
            companyId: this.companyId
        })
    }
}

const DecideMergerShareAction = titleAction('DecideMergerShare', { tradeUp: Type.Boolean() })
export const DecideMergerShare = DecideMergerShareAction.schema
export type DecideMergerShare = Type.Static<typeof DecideMergerShare>
export const isDecideMergerShare = DecideMergerShareAction.is

/**
 * A player with an odd share trades it up to a system share, paying the difference in price, or
 * sells it to the bank at its price, which counts as a sale of the system (§7.5.2 step 5b).
 */
class HydratedDecideMergerShare extends DecideMergerShareAction.Base implements DecideMergerShare {
    declare type: 'DecideMergerShare'
    declare playerId: string
    declare tradeUp: boolean
    isValid(state: HydratedState1828): boolean {
        const merger = state.merger
        return (
            this.source === ActionSource.User &&
            !!merger &&
            mergerStep(state, merger) === 'share' &&
            mergerTrading(state, merger).deciderId === this.playerId
        )
    }
    apply(state: HydratedState1828): void {
        assert(this.isValid(state), 'This player has no share to decide on now')
        mergerUnderWay(state).decisions.push({ playerId: this.playerId, tradeUp: this.tradeUp })
    }
}

export const MergerOutcome = Type.Object(
    {
        /** The acting player, whose turn the merger takes. */
        playerId: Id,
        survivorId: Id,
        absorbedId: Id,
        marketSpaceId: Id,
        directorId: Type.Optional(Id),
        shares: Type.Record(Id, Type.Integer({ minimum: 0 })),
        poolShares: Type.Integer({ minimum: 0 }),
        ipoShares: Type.Integer({ minimum: 0 }),
        payments: Type.Array(CashPayment),
        blockedStationIds: Type.Array(Id),
        floated: Type.Boolean(),
        failure: Type.Optional(Type.String())
    },
    { additionalProperties: false }
)
export type MergerOutcome = Type.Static<typeof MergerOutcome>

const FormSystemAction = systemAction('FormSystem', { metadata: Type.Optional(MergerOutcome) })
export const FormSystem = FormSystemAction.schema
export type FormSystem = Type.Static<typeof FormSystem>
export const isFormSystem = FormSystemAction.is

/** The system forms with its shares, assets and stations, or the merger fails (§7.5.2). */
class HydratedFormSystem extends FormSystemAction.Base implements FormSystem {
    declare type: 'FormSystem'
    declare metadata?: FormSystem['metadata']
    apply(state: HydratedState1828): void {
        assert(this.source === ActionSource.System && this.formationDue(state), 'No system is due')
        const merger = mergerUnderWay(state)
        const trading = mergerTrading(state, merger)
        const director = mergerDirector(state, merger, trading)
        const blocked = this.blockedStations(state, merger).map((station) => station.id)
        const base = {
            playerId: mergerProposerId(state),
            survivorId: merger.survivorId,
            absorbedId: merger.absorbedId,
            marketSpaceId: trading.marketSpaceId,
            poolShares: trading.poolShares,
            ipoShares: trading.ipoShares,
            blockedStationIds: blocked
        }
        if ('failure' in director) {
            // The acting player is considered to have passed (§7.5.2.2), which waits only for a
            // sale they already owed.
            state.stockRound.turn.bought = true
            state.activePlayerIds = [mergerProposerId(state)]
            if (mustSellShares(state, mergerProposerId(state), StockRules1828)) delete state.merger
            else merger.stage = 'failed'
            this.metadata = {
                ...base,
                shares: playerShares(trading),
                payments: [],
                floated: false,
                failure: director.failure
            }
            return
        }
        assert(!trading.deciderId, 'A system forms once its single shares are decided')
        delete state.merger
        const payments = this.settleSingles(state, merger, trading)
        const floated = this.formSystem(state, merger, trading, director, blocked)
        markTurnPurchase(state)
        recordStockAction(state, mergerProposerId(state), StockRules1828.round)
        state.activePlayerIds = [mergerProposerId(state)]
        this.metadata = {
            ...base,
            directorId: director.directorId,
            shares: director.shares,
            payments,
            floated
        }
    }

    /** The stations that become blocking stations, chosen or the absorbed company's. */
    private blockedStations(state: HydratedState1828, merger: Merger1828): PlacedStation[] {
        return sharedHexes(state, merger).map(({ stations }) => {
            const chosen = stations.find((station) => merger.blockedStationIds.includes(station.id))
            const absorbed = stations.find((station) => station.companyId === merger.absorbedId)
            const blocked = chosen ?? absorbed
            assertExists(blocked, 'A shared hex holds an absorbed company’s station')
            return blocked
        })
    }

    private formationDue(state: HydratedState1828): boolean {
        const merger = state.merger
        return !!merger && mergerStep(state, merger) === 'forming'
    }

    /** Singles traded up pay the difference to the bank; singles sold take their price (§7.5.2.1). */
    private settleSingles(
        state: HydratedState1828,
        merger: Merger1828,
        trading: MergerTrading
    ): CashPayment[] {
        const payments: CashPayment[] = trading.singles.flatMap((single): CashPayment[] => {
            const owner = player(single.playerId)
            if (!single.tradeUp)
                return [{ from: { kind: 'bank' }, to: owner, amount: single.price }]
            const cost = trading.systemPrice - single.price
            if (cost > 0) return [{ from: owner, to: { kind: 'bank' }, amount: cost }]
            if (cost < 0) return [{ from: { kind: 'bank' }, to: owner, amount: -cost }]
            return []
        })
        settleCashPayments(state, payments)
        // Failing to trade up a single counts as a sale of the system this round (§7.3).
        for (const single of trading.singles)
            if (!single.tradeUp)
                recordStockRoundSale(state.stockRound, player(single.playerId), merger.survivorId)
        return payments
    }

    /**
     * The survivor becomes the system: its certificates held as traded, one donated to its treasury;
     * the absorbed company closes as its second shell, its assets, stations and coal marker joining
     * the system (§7.5.2, §13.4). Returns whether the system has floated.
     */
    private formSystem(
        state: HydratedState1828,
        merger: Merger1828,
        trading: MergerTrading,
        director: { directorId: string; shares: Record<string, number> },
        blockedStationIds: readonly string[]
    ): boolean {
        const { survivorId, absorbedId } = merger
        const survivor = getCompany(state, survivorId)
        const absorbed = getCompany(state, absorbedId)
        const bothFloated = !!survivor.floated && !!absorbed.floated

        // Selling either company this round is a sale of the system (§7.5.2).
        for (const { playerId } of state.players)
            if (soldEither(state, playerId, [survivorId, absorbedId]))
                recordStockRoundSale(state.stockRound, player(playerId), survivorId)

        this.reissueShares(state, survivorId, absorbedId, trading, director)

        const absorbedTrainIds = trainsOwnedBy(state, {
            kind: 'company',
            companyId: absorbedId
        }).map((train) => train.id)
        transferCompanyAssets(state, absorbedId, survivorId, { loans: false })
        if (!bothFloated) {
            // Only one floated: its treasury is discarded; the system is capitalised as it floats.
            const cash = finiteCashOwnedBy(state, { kind: 'company', companyId: survivorId })
            if (cash)
                settleCashPayments(state, [
                    {
                        from: { kind: 'company', companyId: survivorId },
                        to: { kind: 'bank' },
                        amount: cash
                    }
                ])
        }
        this.mergeStations(state, survivorId, absorbedId, blockedStationIds)
        this.mergeCoal(state, survivorId, absorbedId)

        removeStockMarker(state.stockMarket, absorbedId)
        placeStockMarker(state.stockMarket, survivorId, trading.marketSpaceId)
        absorbed.closed = true
        delete absorbed.president
        survivor.floated = bothFloated
        survivor.funded = bothFloated
        survivor.president = player(director.directorId)
        const survivorTrainIds = trainsOwnedBy(state, { kind: 'company', companyId: survivorId })
            .map((train) => train.id)
            .filter((trainId) => !absorbedTrainIds.includes(trainId))
        state.systems[survivorId] = {
            absorbedId,
            shellTrainIds: [survivorTrainIds, absorbedTrainIds]
        }
        return bothFloated
    }

    /**
     * The survivor's certificates carry the system's shares: the director's certificate and singles
     * to the players, one to the treasury, the rest to the bank pool and the IPO; the absorbed
     * company's leave the game.
     */
    private reissueShares(
        state: HydratedState1828,
        survivorId: string,
        absorbedId: string,
        trading: MergerTrading,
        director: { directorId: string; shares: Record<string, number> }
    ): void {
        removeCertificates(
            state,
            state.certificates
                .filter((certificate) => certificate.companyId === absorbedId)
                .map((certificate) => certificate.id)
        )
        const certificates = state.certificates.filter(
            (certificate) => certificate.companyId === survivorId && certificate.kind === 'share'
        )
        const president = certificates.find(
            (certificate) => certificate.kind === 'share' && certificate.president
        )
        assertExists(president, 'The survivor has a director’s certificate')
        const singles = certificates.filter((certificate) => certificate !== president)
        const holders: { owner: Owner; poolId?: string; buyable?: false }[] = []
        for (const [playerId, shares] of Object.entries(director.shares)) {
            const count = playerId === director.directorId ? shares - 2 : shares
            for (let index = 0; index < count; index++) holders.push({ owner: player(playerId) })
        }
        holders.push({ owner: { kind: 'company', companyId: survivorId } })
        for (let index = 0; index < trading.poolShares; index++)
            holders.push({ owner: { kind: 'bank' }, poolId: MarketPoolId1828 })
        for (let index = 0; index < trading.ipoShares; index++)
            holders.push({ owner: { kind: 'bank' }, poolId: IpoPoolId1828 })
        assert(holders.length === singles.length, 'The system’s shares are all accounted for')
        president.owner = player(director.directorId)
        delete president.poolId
        singles.forEach((certificate, index) => {
            const holder = holders[index]
            certificate.owner = holder.owner
            if (holder.poolId) certificate.poolId = holder.poolId
            else delete certificate.poolId
        })
    }

    /**
     * The absorbed company's stations become the system's, where they stand, but a blocking station
     * takes one of each shared hex, its marker back on the system's charter; the absorbed company's
     * unplaced homes are the system's to place (§7.5.2 step 3, §13.4).
     */
    private mergeStations(
        state: HydratedState1828,
        survivorId: string,
        absorbedId: string,
        blockedStationIds: readonly string[]
    ): void {
        for (const station of state.stations.filter(
            (entry) => entry.companyId === absorbedId && entry.status !== 'removed'
        )) {
            if (blockedStationIds.includes(station.id)) {
                addCompanyStations(state, survivorId, 1)
                continue
            }
            addCompanyStations(state, survivorId, 1)
            const added = state.stations.at(-1)
            assertExists(added, 'The system gains a station for each absorbed one')
            if (station.status === 'placed') replaceStation(state, station.id, added.id)
            else
                state.stations = state.stations.map((entry) =>
                    entry.id === station.id
                        ? { id: entry.id, companyId: entry.companyId, status: 'removed' }
                        : entry
                )
        }
        for (const stationId of blockedStationIds) {
            const station = state.stations.find((entry) => entry.id === stationId)
            if (station?.companyId !== survivorId || station.status !== 'placed') continue
            state.stations = state.stations.map((entry) =>
                entry.id === stationId ? { ...station, companyId: absorbedId } : entry
            )
            addCompanyStations(state, survivorId, 1)
        }
        state.stationReservations = state.stationReservations.map((reservation) =>
            reservation.companyId === absorbedId
                ? { ...reservation, companyId: survivorId }
                : reservation
        )
    }

    /** A system holds one coal marker; a second returns to the Virginia Coalfields (§7.5.2 step 3). */
    private mergeCoal(state: HydratedState1828, survivorId: string, absorbedId: string): void {
        const rights = state.accessRights ?? []
        const survivorHolds = rights.some(
            (right) => right.rightId === CoalRightId && right.companyId === survivorId
        )
        state.accessRights = rights.flatMap((right) =>
            right.companyId !== absorbedId
                ? [right]
                : survivorHolds && right.rightId === CoalRightId
                  ? []
                  : [{ ...right, companyId: survivorId }]
        )
    }
}

const MergerDecisionActions = [
    HydratedAnswerMerger,
    HydratedBlockMergerStation,
    HydratedChooseSetAsideShare,
    HydratedDecideMergerShare
]
type MergerDecisionAction = InstanceType<(typeof MergerDecisionActions)[number]>

function isMergerDecision(action: HydratedAction): action is MergerDecisionAction {
    return MergerDecisionActions.some((kind) => action instanceof kind)
}

export type MergerStep = 'consent' | 'station' | 'set-aside' | 'share' | 'forming'

/** What a merger under way waits for (§7.5.2). */
export function mergerStep(state: HydratedState1828, merger: Merger1828): MergerStep {
    if (merger.stage === 'consent') return 'consent'
    if (pendingStationChoices(state, merger).length) return 'station'
    // Nothing left to decide matters once the merger cannot form: a failure undoes it all.
    if (!mergerCanSucceed(state, merger)) return 'forming'
    if (pendingSetAside(state, merger)) return 'set-aside'
    return mergerTrading(state, merger).deciderId ? 'share' : 'forming'
}

function mergerTurn(
    state: HydratedState1828
): { playerId: string; action: string } | { system: true } | undefined {
    const merger = state.merger
    if (!merger) return undefined
    if (merger.stage === 'failed')
        return { playerId: mergerProposerId(state), action: 'FinishStockTurn' }
    const acting = (playerId: string | undefined, action: string) => {
        assertExists(playerId, 'A merger under way waits for a player')
        return { playerId, action }
    }
    switch (mergerStep(state, merger)) {
        case 'consent':
            return acting(consentPlayerId(state, merger), 'AnswerMerger')
        case 'station':
            return acting(mergerProposerId(state), 'BlockMergerStation')
        case 'set-aside':
            return acting(pendingSetAside(state, merger), 'ChooseSetAsideShare')
        case 'share':
            return acting(mergerTrading(state, merger).deciderId, 'DecideMergerShare')
        case 'forming':
            return { system: true }
    }
}

/**
 * A stock turn may start a merger instead of buying (§7.1); while one is in progress the players
 * it waits for decide in turn, then the system forms or the merger fails. A failed merger leaves
 * finishing the turn as the only action, which the family's automatic stock turn then takes.
 */
export function mergesCompanies(handler: StateHandler1828): StateHandler1828 {
    return {
        isValidAction(action: HydratedAction, context: MachineContext<HydratedState1828>) {
            const state = context.gameState
            const turn = mergerTurn(state)
            if (!turn) {
                if (action instanceof HydratedProposeMerger) return action.isValid(state)
                return handler.isValidAction(action, context)
            }
            if ('system' in turn) return action instanceof HydratedFormSystem
            if (state.merger?.stage === 'failed')
                return isFinishStockTurn(action) && action.playerId === turn.playerId
            return (
                isMergerDecision(action) &&
                action.type === turn.action &&
                action.playerId === turn.playerId &&
                action.isValid(state)
            )
        },
        validActionsForPlayer(playerId: string, context: MachineContext<HydratedState1828>) {
            const state = context.gameState
            const turn = mergerTurn(state)
            if (!turn)
                return [
                    ...handler.validActionsForPlayer(playerId, context),
                    ...(offersMerger(state, playerId) ? ['ProposeMerger'] : [])
                ]
            return 'playerId' in turn && turn.playerId === playerId ? [turn.action] : []
        },
        enter(context: MachineContext<HydratedState1828>) {
            const state = context.gameState
            const turn = mergerTurn(state)
            if (!turn) {
                handler.enter(context)
                return
            }
            if ('system' in turn) context.addSystemAction(FormSystem, {})
            else state.activePlayerIds = [turn.playerId]
        },
        onAction(action: HydratedAction, context: MachineContext<HydratedState1828>) {
            if (context.gameState.merger?.stage === 'failed' && isFinishStockTurn(action))
                delete context.gameState.merger
            if (
                isMergerDecision(action) ||
                action instanceof HydratedProposeMerger ||
                action instanceof HydratedFormSystem
            )
                return context.gameState.machineState
            return handler.onAction(action, context)
        }
    }
}

export const MergerActions1828 = [
    ProposeMergerAction.define((action) => new HydratedProposeMerger(action)),
    AnswerMergerAction.define((action) => new HydratedAnswerMerger(action)),
    BlockMergerStationAction.define((action) => new HydratedBlockMergerStation(action)),
    ChooseSetAsideShareAction.define((action) => new HydratedChooseSetAsideShare(action)),
    DecideMergerShareAction.define((action) => new HydratedDecideMergerShare(action)),
    FormSystemAction.define((action) => new HydratedFormSystem(action))
]
