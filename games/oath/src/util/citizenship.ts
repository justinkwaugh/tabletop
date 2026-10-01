import { discardRegionFor, HydratedOathGameState } from '../model/gameState.js'
import type { WarbandGroup } from '../model/campaign.js'
import type { PileDeposit } from '../model/hidden.js'
import { PlayerStatus, Region } from '../model/oathEnums.js'
import { IMPERIAL_WARBANDS, type WarbandOwner } from '../model/warbandCounts.js'
import {
    addWarbandsToBoard,
    addWarbandsToSite,
    killWarbands,
    removeWarbandsFrom,
    takeFromGroups,
    takeWarbandsFromBank,
    warbandsInBankFor,
    forceTotal,
    boardWarbandGroups,
    warbandGroupsAtSites
} from './force.js'
import { discardRevealedVision } from './revealedVision.js'
import { regionOfPawn } from '../powers/vocabulary.js'
import { MAX_SUPPLY } from './rest.js'
import { holdsTheTurn } from './turn.js'

export interface ConversionResult {
    replaced: WarbandGroup[]
    /** R-9.3 may cap this below the number asked for. */
    replacedCount: number
    /** R-6.6.2 — for want of Imperial warbands, removed (a Citizen) or left as they were (an Exile, R-6.6.3). */
    unreplacedCount: number
    discardedVisionId?: string
    /** R-10.5 */
    discardPileRegion?: Region
    /** R-6.6.2 */
    flippedUsurperToOathkeeper: boolean
}

/** R-6.6.2 — board first, then map order: the order an Imperial shortage takes them. */
export function citizenshipReplacementGroups(
    state: HydratedOathGameState,
    playerId: string
): WarbandGroup[] {
    return [
        ...boardWarbandGroups(state, playerId).filter((group) => group.owner !== IMPERIAL_WARBANDS),
        ...warbandGroupsAtSites(state, state.allSiteIds(), [playerId])
    ]
}

// R-X.1 — `replacementChoice` names which warbands become Imperial when the Empire's are short.
export function becomeCitizen(
    state: HydratedOathGameState,
    playerId: string,
    replacementChoice?: readonly WarbandGroup[]
): ConversionResult {
    const player = state.getPlayerState(playerId)

    player.status = PlayerStatus.Citizen

    const all = citizenshipReplacementGroups(state, playerId)
    const available = warbandsInBankFor(state, IMPERIAL_WARBANDS)
    const wanted = forceTotal(all)
    const chosen = available >= wanted ? all : (replacementChoice ?? takeFromGroups(all, available))

    const replaced = replaceWarbands(state, chosen, IMPERIAL_WARBANDS)
    const replacedCount = forceTotal(replaced)
    // R-6.6.2 — "chooses which warbands to remove and which to replace": the rest leave play.
    removeUnreplaced(state, all, replaced)

    let discardedVisionId: string | undefined
    let discardPileRegion: Region | undefined
    if (player.revealedVisionId) {
        const region = regionOfPawn(state, playerId)
        discardedVisionId = discardRevealedVision(state, playerId, region)
        if (discardedVisionId) {
            discardPileRegion = discardRegionFor(region)
        }
    }

    // R-2.11.c — the title does not move, only its face.
    const flippedUsurperToOathkeeper =
        state.oathkeeperPlayerId === playerId && state.oathkeeperIsUsurper === true
    if (flippedUsurperToOathkeeper) {
        state.oathkeeperIsUsurper = false
    }

    // R-1.10 — unconditional; only the marker moves, so the turn's spent-Supply ledger stands.
    player.supply = MAX_SUPPLY

    return {
        replaced,
        replacedCount,
        unreplacedCount: wanted - replacedCount,
        discardedVisionId,
        discardPileRegion,
        flippedUsurperToOathkeeper
    }
}

/** R-6.7, R-6.8, R-6.6.3 — the board only; R-9.3 caps the replacement when their own run short. */
export function becomeExile(state: HydratedOathGameState, playerId: string): ConversionResult {
    const player = state.getPlayerState(playerId)

    player.status = PlayerStatus.Exile

    const groups = boardWarbandGroups(state, playerId).filter((group) => group.owner !== playerId)

    const wanted = forceTotal(groups)
    const available = warbandsInBankFor(state, playerId)
    const chosen = available >= wanted ? groups : takeFromGroups(groups, available)

    const replaced = replaceWarbands(state, chosen, playerId)
    const replacedCount = forceTotal(replaced)

    // R-1.10 — only the marker moves; the Supply already spent this turn stays spent.
    player.supply = MAX_SUPPLY

    return {
        replaced,
        replacedCount,
        unreplacedCount: wanted - replacedCount,
        flippedUsurperToOathkeeper: false
    }
}

function removeUnreplaced(
    state: HydratedOathGameState,
    groups: readonly WarbandGroup[],
    replaced: readonly WarbandGroup[]
): void {
    for (const group of groups) {
        const done = replaced
            .filter((r) => r.owner === group.owner && sameLocation(r.at, group.at))
            .reduce((n, r) => n + r.count, 0)
        const left = group.count - done
        if (left <= 0) continue
        removeWarbandsFrom(state, group.at, group.owner, left)
        // R-10.13
        killWarbands(state, group.owner, left)
    }
}

function sameLocation(a: WarbandGroup['at'], b: WarbandGroup['at']): boolean {
    return a.kind === 'site'
        ? b.kind === 'site' && a.siteId === b.siteId
        : b.kind === 'board' && a.playerId === b.playerId
}

/** R-9.3 — only as many are replaced as the bank gives. */
function replaceWarbands(
    state: HydratedOathGameState,
    groups: readonly WarbandGroup[],
    toOwner: WarbandOwner
): WarbandGroup[] {
    const moved: WarbandGroup[] = []

    for (const group of groups) {
        if (group.owner === toOwner || group.count <= 0) continue

        const taken = takeWarbandsFromBank(state, toOwner, group.count)
        if (taken === 0) continue

        removeWarbandsFrom(state, group.at, group.owner, taken)
        // R-10.13 — a displaced warband goes to the bank a killed one would.
        killWarbands(state, group.owner, taken)

        if (group.at.kind === 'site') {
            addWarbandsToSite(state, group.at.siteId, toOwner, taken)
        } else {
            addWarbandsToBoard(state, group.at.playerId, toOwner, taken)
        }

        moved.push({ at: group.at, owner: group.owner, count: taken })
    }

    return moved
}

export function becomeCitizenByPower(
    state: HydratedOathGameState,
    playerId: string
): ConversionResult {
    const conversion = becomeCitizen(state, playerId)
    state.getPlayerState(playerId).supply = MAX_SUPPLY
    return conversion
}

/** R-9.4, R-6.6.2 */
export function visionDeposits(conversion: ConversionResult): PileDeposit[] | undefined {
    const { discardedVisionId, discardPileRegion } = conversion
    return discardedVisionId && discardPileRegion
        ? [{ region: discardPileRegion, cardIds: [discardedVisionId] }]
        : undefined
}

/** R-6.6.2 — "ends their Act Phase **if it is their turn**". */
export function citizenshipEndsActPhase(state: HydratedOathGameState, playerId: string): boolean {
    return holdsTheTurn(state, playerId)
}
