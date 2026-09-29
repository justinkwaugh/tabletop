import { HydratedOathGameState } from '../model/gameState.js'
import { Banner, Region, Suit, TOTAL_FAVOR } from '../model/oathEnums.js'
import type { Color } from '@tabletop/common'
import type { WarbandCounts } from '../model/warbandCounts.js'
import { totalWarbands, countOf, adjustCount, warbandEntries } from '../util/warbands.js'

/** R-1.4 */
export function favorCensus(state: HydratedOathGameState): number {
    let total = state.favorSupply

    for (const suit of Object.values(Suit)) {
        total += state.favorBank[suit]
    }
    for (const player of state.players) {
        total += player.favor
    }
    for (const tokens of Object.values(state.cardTokens)) {
        total += tokens.favor
    }
    // R-2.5.2, R-9.3 — the Darkest Secret's value is secrets, which are not component-limited.
    total += state.banners[Banner.PeoplesFavor].value

    return total
}

/** R-9.3, R-1.4 — no rule creates or destroys favor. */
export function expectFavorConserved(state: HydratedOathGameState, mutate: () => void): void {
    const before = favorCensus(state)
    mutate()
    const after = favorCensus(state)
    if (before !== after) {
        throw Error(`Favor was created or destroyed (${before} -> ${after})`)
    }
}

/** R-1.4 */
export function expectFullFavorComplement(state: HydratedOathGameState): void {
    const total = favorCensus(state)
    if (total !== TOTAL_FAVOR) {
        throw Error(`Expected ${TOTAL_FAVOR} favor in play, found ${total}`)
    }
}

export function warbandCensus(state: HydratedOathGameState): WarbandCounts {
    const census: WarbandCounts = {}
    const add = (counts: WarbandCounts) => {
        for (const [color, n] of warbandEntries(counts)) {
            adjustCount(census, color, n)
        }
    }

    for (const player of state.players) {
        add(player.warbandsOnBoard)
        add(player.warbandsInPersonalBank)
    }
    for (const bySite of Object.values(state.warbandsBySite)) {
        add(bySite)
    }
    for (const onCard of Object.values(state.warbandsOnCards)) {
        add(onCard)
    }
    // Hospital — set aside mid-Campaign, still in play.
    for (const held of state.campaign?.heldForHospital ?? []) add({ [held.color]: held.count })

    return census
}

/** R-1.8, R-1.9, R-10.13 — warbands are only moved, never created or destroyed. */
export function warbandConservationBreaches(
    before: WarbandCounts,
    after: WarbandCounts
): Array<{ color: Color; before: number; after: number }> {
    const colors = new Set(
        [...warbandEntries(before), ...warbandEntries(after)].map(([color]) => color)
    )
    return [...colors]
        .map((color) => ({
            color,
            before: countOf(before, color),
            after: countOf(after, color)
        }))
        .filter((entry) => entry.before !== entry.after)
}

/** R-6.5, R-5.5.7.I, R-1.8 — one colour per site; purple is one colour (R-6.6.3). */
export function multiColorSites(
    state: HydratedOathGameState
): Array<{ siteId: string; colors: Color[] }> {
    return Object.entries(state.warbandsBySite)
        .map(([siteId, counts]) => ({
            siteId,
            colors: warbandEntries(counts)
                .filter(([, n]) => n > 0)
                .map(([color]) => color)
        }))
        .filter((entry) => entry.colors.length > 1)
}

export function expectOneWarbandColorPerSite(state: HydratedOathGameState): void {
    const breaches = multiColorSites(state)
    if (breaches.length > 0) {
        const detail = breaches.map((b) => `${b.siteId}: ${b.colors.join(' + ')}`).join(', ')
        throw Error(`Sites hold more than one player's warbands (${detail})`)
    }
}

export function expectWarbandsConserved(state: HydratedOathGameState, mutate: () => void): void {
    const before = warbandCensus(state)
    mutate()
    const breaches = warbandConservationBreaches(before, warbandCensus(state))
    if (breaches.length > 0) {
        const detail = breaches.map((b) => `${b.color}: ${b.before} -> ${b.after}`).join(', ')
        throw Error(`Warbands were created or destroyed (${detail})`)
    }
}

function warbandTotal(state: HydratedOathGameState): number {
    return totalWarbands(warbandCensus(state))
}

/** R-6.6.2, R-6.7, R-6.8 — colour-blind, so it holds through a recolour. */
export function expectWarbandTotalConserved(
    state: HydratedOathGameState,
    mutate: () => void
): void {
    const before = warbandTotal(state)
    mutate()
    const after = warbandTotal(state)
    if (before !== after) {
        throw Error(`Warbands were created or destroyed (total: ${before} -> ${after})`)
    }
}

/** R-6.6.2, R-6.7, R-6.8 — a wrong recolour can leave the totals intact. */
export function expectRecolorExchange(
    before: WarbandCounts,
    after: WarbandCounts,
    from: Color,
    to: Color,
    count: number
): void {
    const moved = (color: Color) => countOf(after, color) - countOf(before, color)
    const problems: string[] = []
    if (moved(from) !== -count) {
        problems.push(`${from} moved by ${moved(from)}, expected -${count}`)
    }
    if (moved(to) !== count) {
        problems.push(`${to} moved by ${moved(to)}, expected +${count}`)
    }
    if (problems.length > 0) {
        throw Error(
            `Recolour did not exchange ${count} ${from} for ${count} ${to} (${problems.join('; ')})`
        )
    }
}

/** R-9.4 — each public pile count agrees with the pile the vault holds. */
export function expectCountsMatchTheVault(state: HydratedOathGameState): void {
    for (const region of Object.values(Region)) {
        const held = state.requireVault().discardPiles[region].length
        const counted = state.discardPileCounts[region]
        if (held !== counted) {
            throw Error(`${region} pile: the vault holds ${held}, the count says ${counted}`)
        }
    }
}
