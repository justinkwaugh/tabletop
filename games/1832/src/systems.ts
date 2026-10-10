import * as Type from 'typebox'
import { assert, assertExists } from '@tabletop/common'
import {
    PresidencyChange,
    applyPresidencyChange,
    companyMarketSpace,
    evaluatePresidency,
    placeStockMarker,
    playersAfterPresident,
    sharesOwned,
    type StockMarket,
    type StockMarketSpace
} from '@tabletop/18xx'
import type { EighteenThirtyTwoState } from './state.js'
import { refreshOwnershipExcess } from './ownershipExcess.js'
import { isLowerArea } from './stockMarket.js'
import { Absorption, absorbCompany, discardSharedHome } from './absorption.js'

/** Systems A–E, named for the modern railroads that grew from these lines. */
export const EighteenThirtyTwoSystems = [
    { id: 'AMTK', name: 'Amtrak', letter: 'A' },
    { id: 'BNSF', name: 'BNSF Railway', letter: 'B' },
    { id: 'IC', name: 'Illinois Central Railroad', letter: 'C' },
    { id: 'CSX', name: 'CSX Transportation', letter: 'D' },
    { id: 'NS', name: 'Norfolk Southern Railway', letter: 'E' }
] as const

export const SystemShareCount = 20
const PresidentShares = 4
const MaximumSystemPar = 275

export function isSystem(state: Pick<EighteenThirtyTwoState, 'systems'>, companyId: string) {
    return companyId in state.systems
}

/** The 10-share companies a company stands for: a System's two shells, or the company itself. */
export function shellsOf(state: Pick<EighteenThirtyTwoState, 'systems'>, companyId: string) {
    return state.systems[companyId] ?? [companyId]
}

/** The System a component company was merged into. */
export function systemOf(
    state: Pick<EighteenThirtyTwoState, 'systems'>,
    companyId: string
): string | undefined {
    return Object.keys(state.systems).find((systemId) =>
        state.systems[systemId].includes(companyId)
    )
}

/** The company now holding a railroad's assets: itself, or what it merged into (§11.6, §11.7). */
export function successorOf(state: Pick<EighteenThirtyTwoState, 'mergers'>, companyId: string) {
    let current = companyId
    for (;;) {
        const merger = state.mergers.find(
            (entry) => entry.survivorId !== current && entry.companyIds.includes(current)
        )
        if (!merger) return current
        current = merger.survivorId
    }
}

export function nextSystemId(state: Pick<EighteenThirtyTwoState, 'systems'>): string | undefined {
    return EighteenThirtyTwoSystems.find((system) => !isSystem(state, system.id))?.id
}

function combinedShares(
    state: EighteenThirtyTwoState,
    companyIds: readonly string[],
    playerId: string
) {
    return companyIds.reduce(
        (total, companyId) => total + sharesOwned(state, companyId, { kind: 'player', playerId }),
        0
    )
}

/**
 * The System's president: the initiator, or the first player clockwise from them, holding four
 * shares of the two companies (§11.6.1).
 */
export function systemPresident(
    state: EighteenThirtyTwoState,
    companyIds: readonly string[],
    initiatorPlayerId: string
): string | undefined {
    const order = state.turnManager.turnOrder
    const start = order.indexOf(initiatorPlayerId)
    assert(start >= 0, 'The initiator is a player')
    return [...order.slice(start), ...order.slice(0, start)].find(
        (playerId) => combinedShares(state, companyIds, playerId) >= PresidentShares
    )
}

// The nearest price, a tie rounding up.
function nearestPrice(prices: readonly number[], target: number): number {
    return prices.reduce((best, price) =>
        Math.abs(price - target) < Math.abs(best - target) ||
        (Math.abs(price - target) === Math.abs(best - target) && price > best)
            ? price
            : best
    )
}

function spaceAt(market: StockMarket, row: number, column: number) {
    return market.spaces.find((space) => space.row === row && space.column === column)
}

/**
 * The System's market space: the average of the two prices, rounded to a value in the row of
 * the leftmost component (the lower when they share a column) with a tie upward, then down and
 * right along that price's diagonal to the soft or hard ledge (§11.6.3). **Ruling:** a row
 * without the rounded price takes its own nearest value.
 */
export function systemMarketSpace(
    market: StockMarket,
    companyIds: readonly string[]
): StockMarketSpace {
    const [first, second] = companyIds.map((companyId) => companyMarketSpace(market, companyId))
    const leftmost =
        first.column < second.column || (first.column === second.column && first.row > second.row)
            ? first
            : second
    const row = market.spaces.filter((entry) => entry.row === leftmost.row)
    const price = nearestPrice(
        row.map((entry) => entry.price),
        (first.price + second.price) / 2
    )
    let space = row.find((entry) => entry.price === price)
    assertExists(space, 'The row holds its own price')
    for (;;) {
        const next = spaceAt(market, space.row + 1, space.column + 1)
        if (!next || next.price !== price || isLowerArea(next) !== isLowerArea(space)) break
        space = next
    }
    return space
}

export const SystemFormation = Type.Object(
    {
        systemId: Type.String(),
        companyIds: Type.Array(Type.String(), { minItems: 2, maxItems: 2 }),
        presidentPlayerId: Type.String(),
        marketSpaceId: Type.String(),
        parPrice: Type.Integer({ minimum: 1 }),
        exchangedCertificateIds: Type.Array(Type.String()),
        absorptions: Type.Array(Absorption),
        discardedHomeStationId: Type.Optional(Type.String()),
        presidency: Type.Optional(PresidencyChange)
    },
    { additionalProperties: false }
)
export type SystemFormation = Type.Static<typeof SystemFormation>

// The president gives up their component president's certificates, then single shares, to four.
function exchangedCertificates(
    state: EighteenThirtyTwoState,
    companyIds: readonly string[],
    playerId: string
): string[] {
    const held = state.certificates.flatMap((certificate) =>
        !certificate.retired &&
        certificate.kind === 'share' &&
        companyIds.includes(certificate.companyId) &&
        certificate.owner.kind === 'player' &&
        certificate.owner.playerId === playerId
            ? [certificate]
            : []
    )
    const ordered = [
        ...held.filter((certificate) => certificate.president),
        ...held.filter((certificate) => !certificate.president)
    ]
    const chosen: string[] = []
    let shares = 0
    for (const certificate of ordered) {
        if (shares === PresidentShares) break
        if (shares + certificate.shares > PresidentShares) continue
        chosen.push(certificate.id)
        shares += certificate.shares
    }
    assert(shares === PresidentShares, 'The System president exchanges four shares')
    return chosen
}

/**
 * Forms a System of two 10-share companies (§11.6): new twenty-share certificates take the
 * components' places, the System takes their assets and stations, and the components close as
 * its shells.
 */
export function formSystem(
    state: EighteenThirtyTwoState,
    companyIds: readonly [string, string],
    initiatorPlayerId: string
): SystemFormation {
    const systemId = nextSystemId(state)
    assertExists(systemId, 'A System remains available')
    const system = EighteenThirtyTwoSystems.find((entry) => entry.id === systemId)
    assertExists(system, 'Systems are defined')
    const presidentPlayerId = systemPresident(state, companyIds, initiatorPlayerId)
    assertExists(presidentPlayerId, 'A player holds four shares of the components')
    const space = systemMarketSpace(state.stockMarket, companyIds)
    const parPrice = Math.min(space.price, MaximumSystemPar)
    const exchangedCertificateIds = exchangedCertificates(state, companyIds, presidentPlayerId)
    const president = { kind: 'player' as const, playerId: presidentPlayerId }

    state.companies.push({
        id: systemId,
        name: system.name,
        kind: 'major',
        shareCount: SystemShareCount,
        parPrice,
        started: true,
        funded: true,
        floated: true,
        operated: true,
        president
    })
    state.cash.push({ owner: { kind: 'company', companyId: systemId }, amount: 0 })

    let number = 0
    const issued: EighteenThirtyTwoState['certificates'] = [
        {
            id: `${systemId}:president`,
            companyId: systemId,
            kind: 'share',
            shares: PresidentShares,
            president: true,
            certificateLimitCount: 1,
            retired: false,
            owner: president
        }
    ]
    state.certificates = state.certificates.map((certificate) => {
        if (
            certificate.retired ||
            certificate.kind !== 'share' ||
            !companyIds.includes(certificate.companyId)
        )
            return certificate
        if (!exchangedCertificateIds.includes(certificate.id)) {
            const owner =
                certificate.owner.kind === 'company'
                    ? { kind: 'company' as const, companyId: systemId }
                    : certificate.owner
            number++
            issued.push({
                id: `${systemId}:share:${number}`,
                companyId: systemId,
                kind: 'share',
                shares: certificate.shares,
                president: false,
                certificateLimitCount: 1,
                retired: false,
                owner,
                ...(certificate.poolId ? { poolId: certificate.poolId } : {})
            })
        }
        const { owner: _owner, poolId: _poolId, ...retired } = certificate
        return { ...retired, retired: true }
    })
    state.certificates.push(...issued)

    placeStockMarker(state.stockMarket, systemId, space.id)
    const [first, second] = companyIds
    const discardedHomeStationId = discardSharedHome(state, first, second)
    const reissued = companyIds.flatMap((companyId) => state.reissues?.[companyId] ?? [])
    if (reissued.length) state.reissues = { ...state.reissues, [systemId]: Math.max(...reissued) }
    const absorptions = companyIds.map((companyId) =>
        absorbCompany(state, companyId, systemId, 'system')
    )
    state.systems = { ...state.systems, [systemId]: [...companyIds] }

    const presidency = evaluatePresidency(
        state,
        systemId,
        playersAfterPresident(state, systemId, state.turnManager.turnOrder),
        undefined,
        true
    )
    if (presidency.change) applyPresidencyChange(state, presidency.change)
    for (const player of state.players)
        refreshOwnershipExcess(state, systemId, { kind: 'player', playerId: player.playerId })

    return {
        systemId,
        companyIds: [...companyIds],
        presidentPlayerId,
        marketSpaceId: space.id,
        parPrice,
        exchangedCertificateIds,
        absorptions,
        ...(discardedHomeStationId ? { discardedHomeStationId } : {}),
        ...(presidency.change ? { presidency: presidency.change } : {})
    }
}
