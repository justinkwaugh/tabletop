import { receiveFavor, spendFavor, usableFavor } from './favor.js'
import { assertExists } from '@tabletop/common'
import { HydratedOathGameState } from '../model/gameState.js'
import { Banner, Suit } from '../model/oathEnums.js'
import { siteRecord } from '../data/sites.js'
import { pawnSiteId } from './pawn.js'

/** R-4.1.1.I, R-X.1 */
export type PeoplesFavorStep = { kind: 'place' } | { kind: 'return'; toSuit: Suit }

/** R-4.1.1.III */
export const MOB_THRESHOLD = 6

/** R-4.1.1.I, R-X.1 — the whole tied set; the player breaks the tie. */
export function banksWithLeastFavor(state: HydratedOathGameState): Suit[] {
    const suits = Object.values(Suit)
    let least = Infinity
    for (const suit of suits) {
        const held = state.favorBank[suit]
        if (held < least) least = held
    }
    return suits.filter((suit) => state.favorBank[suit] === least)
}

/** R-4.1.1.II says "repeat R-4.1.1.I once", so Mob is two resolutions and never more. */
export function peoplesFavorStepCount(state: HydratedOathGameState): number {
    return state.isOnMobSide(Banner.PeoplesFavor) ? 2 : 1
}

// R-4.1.1, R-9.2.a, R-4.1.1-H1 — with neither option open the step is skipped.
export function availablePeoplesFavorOptions(
    state: HydratedOathGameState,
    playerId: string
): PeoplesFavorStep['kind'][] {
    const options: PeoplesFavorStep['kind'][] = []
    if (usableFavor(state, playerId) > 0) options.push('place')
    if (state.banners[Banner.PeoplesFavor].value > 1) options.push('return')
    return options
}

export function reasonCannotTakePeoplesFavorStep(
    state: HydratedOathGameState,
    playerId: string,
    step: PeoplesFavorStep
): string | undefined {
    const available = availablePeoplesFavorOptions(state, playerId)
    if (!available.includes(step.kind)) {
        return step.kind === 'place'
            ? 'you have no favor to place (R-4.1.1.I)'
            : 'the People’s Favor never drops below one favor (R-4.1.1-H1)'
    }
    if (step.kind === 'return' && !banksWithLeastFavor(state).includes(step.toSuit)) {
        return `${step.toSuit} is not a bank with the least favor (R-4.1.1.I)`
    }
    return undefined
}

/** R-4.1.1.I */
export function applyPeoplesFavorStep(
    state: HydratedOathGameState,
    playerId: string,
    step: PeoplesFavorStep
) {
    const reason = reasonCannotTakePeoplesFavorStep(state, playerId, step)
    if (reason) {
        throw Error(`Cannot resolve the People’s Favor Wake power: ${reason}`)
    }

    const banner = state.banners[Banner.PeoplesFavor]
    if (step.kind === 'place') {
        spendFavor(state, playerId, 1)
        banner.value += 1
    } else {
        banner.value -= 1
        state.favorBank[step.toSuit] += 1
    }
}

/** R-4.1.1.III — only R-5.4.4's Recover flips it back. */
export function flipToMobIfAtThreshold(state: HydratedOathGameState): boolean {
    const banner = state.banners[Banner.PeoplesFavor]
    if (banner.value < MOB_THRESHOLD || banner.mobSide === true) return false
    banner.mobSide = true
    return true
}

/** R-4.1.4 — "the Salt Flats, Mine or Drowned City". */
export const OPPORTUNITY_SITE_IDS: ReadonlySet<string> = new Set([
    'site.salt-flats',
    'site.mine',
    'site.drowned-city'
])

/** R-4.1.4 — the site card at the slot, so a facedown slot is never an Opportunity site. */
export function isOpportunitySite(
    state: HydratedOathGameState,
    slotId: string | undefined
): boolean {
    const cardId = state.siteCardAt(slotId)
    return cardId !== undefined && OPPORTUNITY_SITE_IDS.has(cardId)
}

export type OpportunityTake = 'favor' | 'secret'

/** R-4.1.4-H1 — an Opportunity site offers what its card prints. */
export function opportunityTakesOffered(siteCardId: string): OpportunityTake[] {
    const record = siteRecord(siteCardId)
    assertExists(record, `${siteCardId} is not a site card`)
    const text = record.powerText
    const offered: OpportunityTake[] = []
    if (text.includes('[favor]')) offered.push('favor')
    if (text.includes('[secret]')) offered.push('secret')
    return offered
}

export function reasonCannotUseOpportunitySite(
    state: HydratedOathGameState,
    playerId: string,
    take: OpportunityTake
): string | undefined {
    const slotId = pawnSiteId(state, playerId)
    if (!isOpportunitySite(state, slotId)) {
        return 'your pawn is not at an Opportunity site (R-4.1.4)'
    }
    const siteCardId = state.siteCardAt(slotId)
    assertExists(siteCardId, `${slotId} is an Opportunity site with no site card`)
    if (!opportunityTakesOffered(siteCardId).includes(take)) {
        return `${siteCardId} does not offer ${take} (R-4.1.4-H1 — the card's icon governs)`
    }
    // R-8.3.5 moves cards between slots, so tokens are keyed by the card, not the slot.
    const tokens = state.tokensOn(siteCardId)
    if (take === 'favor' && tokens.favor <= 0) return 'the site has no favor (R-11.1)'
    if (take === 'secret' && tokens.secrets <= 0) return 'the site has no secrets (R-11.1)'
    return undefined
}

/** R-4.1.4, R-11.1 — R-10.26's Take moves the token; nothing is gained or burned. */
export function useOpportunitySite(
    state: HydratedOathGameState,
    playerId: string,
    take: OpportunityTake
) {
    const reason = reasonCannotUseOpportunitySite(state, playerId, take)
    if (reason) {
        throw Error(`Cannot use the site power: ${reason}`)
    }

    const player = state.getPlayerState(playerId)
    const cardId = state.siteCardAt(player.siteId)
    assertExists(cardId, `${player.siteId} has no site card`)

    if (take === 'favor') {
        state.addTokensOn(cardId, { favor: -1 })
        receiveFavor(state, playerId, 1)
    } else {
        state.addTokensOn(cardId, { secrets: -1 })
        player.secrets += 1
    }
}
