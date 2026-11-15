import { assert } from '@tabletop/common'
import { HydratedOathGameState } from '../model/gameState.js'
import { IMPERIAL_WARBANDS, type WarbandOwner } from '../model/warbandCounts.js'
import type { WarbandGroup } from '../model/campaign.js'
import type { CagePlacement } from '../model/question.js'
import { OBSIDIAN_CAGE_ID } from '../data/relics.js'
import {
    addWarbandsToBoard,
    cagedReturnAsImperial,
    forceTotal,
    gainWarbandsWithOwner,
    killWarbands,
    removeWarbandsFromCard
} from './force.js'
import { isImperialPlayer } from './rule.js'
import { countOf, describeWarbands, warbandEntries } from './warbands.js'
import { OathRevision, isAtLeastOathRevision } from './revision.js'

/** What a return from the Cage did: groups moved as they are, and a Citizen's replaced by the Empire's. */
export type CageReturn = {
    kept: WarbandGroup[]
    replaced: WarbandGroup[]
    /** The Imperial warbands the Chancellor's bank gave in the replaced groups' place (R-9.3). */
    imperial: number
}

/** R-6.6.3 — every Imperial board holds the Empire's warbands; an Exile's go to their own board. */
export function cageBoardsFor(state: HydratedOathGameState, owner: WarbandOwner): string[] {
    if (owner === IMPERIAL_WARBANDS) {
        return state.players
            .filter((player) => isImperialPlayer(state, player.playerId))
            .map((player) => player.playerId)
    }
    return [state.warbandBankHolderOf(owner)]
}

/**
 * The Cage's Action — each group from the Cage to the board it names. A caged player now a Citizen
 * gets the Empire's warbands from the Chancellor's bank, as far as it goes, and their own go back to
 * their bank (its Q&A, R-6.6.2).
 */
export function returnCagedWarbands(
    state: HydratedOathGameState,
    groups: readonly WarbandGroup[]
): CageReturn {
    const done: CageReturn = { kept: [], replaced: [], imperial: 0 }
    for (const group of groups) {
        const { at, owner, count } = group
        assert(at.kind === 'board', 'Obsidian Cage moves warbands to a board')
        removeWarbandsFromCard(state, OBSIDIAN_CAGE_ID, owner, count)
        if (cagedReturnAsImperial(state, owner)) {
            killWarbands(state, owner, count)
            done.replaced.push(group)
            done.imperial += gainWarbandsWithOwner(
                state,
                at.playerId,
                count,
                IMPERIAL_WARBANDS
            ).gained
        } else {
            addWarbandsToBoard(state, at.playerId, owner, count)
            done.kept.push(group)
        }
    }
    return done
}

/** The Action's History: what moved, then any Citizen's warbands replaced. */
export function cageReturnSummary(state: HydratedOathGameState, done: CageReturn): string {
    const parts: string[] = []
    if (done.kept.length > 0) {
        parts.push(
            `moved ${cageMovedWarbands(state, done.kept)} from the Cage to their owners' boards`
        )
    }
    const replaced = replacedClause(done)
    if (replaced) parts.push(replaced)
    return parts.join('; ')
}

/** R-10.13-H1 — the Cage sent down: each board its warbands went back to, then any replaced. */
export function cageWentBackSummary(done: CageReturn): string {
    const parts: string[] = []
    if (done.kept.length > 0) {
        const boards = done.kept.map(({ at, count }) => {
            assert(at.kind === 'board', 'Obsidian Cage moves warbands to a board')
            return `${count} to ${at.playerId}'s board`
        })
        parts.push(`its warbands went back: ${boards.join(', ')}`)
    }
    const replaced = replacedClause(done)
    if (replaced) parts.push(replaced)
    return parts.join('; ')
}

function replacedClause({ replaced, imperial }: CageReturn): string | undefined {
    if (replaced.length === 0) return undefined
    const wentBack = [...countsByOwner(replaced)].map(
        ([owner, count]) => `${describeWarbands(count, owner)} went back to ${owner}'s bank`
    )
    return `${wentBack.join(' and ')} and ${describeWarbands(imperial, IMPERIAL_WARBANDS)} came from the Chancellor's bank in their place`
}

export function countsByOwner(groups: readonly WarbandGroup[]): Map<WarbandOwner, number> {
    const counts = new Map<WarbandOwner, number>()
    for (const group of groups) {
        counts.set(group.owner, (counts.get(group.owner) ?? 0) + group.count)
    }
    return counts
}

/** R-10.13 — counted by owner from revision 5, so the History draws each in its colour; before it (R-X.4) one count, as recorded then. */
function cageMovedWarbands(state: HydratedOathGameState, kept: readonly WarbandGroup[]): string {
    if (!isAtLeastOathRevision(state, OathRevision.EngineFixes2)) {
        return `${forceTotal(kept)} warbands`
    }
    return [...countsByOwner(kept)]
        .map(([owner, count]) => describeWarbands(count, owner))
        .join(' and ')
}

/** R-10.13-H1 — from revision 17 (R-X.4) the Cage leaving for the relic deck returns its warbands to boards. */
export function cageReturnsToBoards(state: HydratedOathGameState): boolean {
    return isAtLeastOathRevision(state, OathRevision.EngineFixes13)
}

/**
 * R-10.13-H1, R-7.1.3-H1 — the Imperial boards the holder places the caged Empire's warbands on as
 * the Cage goes to the relic deck: every Imperial board when there are two or more, none when the
 * Cage holds none of the Empire's or only the Chancellor's board can take them. Public state only.
 */
export function cagePurpleChoiceBoards(state: HydratedOathGameState): string[] {
    if (!cageReturnsToBoards(state)) return []
    if (countOf(state.warbandsOnCard(OBSIDIAN_CAGE_ID), IMPERIAL_WARBANDS) === 0) return []
    const boards = cageBoardsFor(state, IMPERIAL_WARBANDS)
    return boards.length > 1 ? boards : []
}

/** Why a placement of the caged Empire's warbands is refused; absent, it is what the Cage needs. */
export function reasonCagePlacementInvalid(
    state: HydratedOathGameState,
    placement: CagePlacement | undefined
): string | undefined {
    const boards = cagePurpleChoiceBoards(state)
    if (boards.length === 0) {
        return placement === undefined
            ? undefined
            : 'the Obsidian Cage’s warbands each have one board to go to'
    }
    const caged = countOf(state.warbandsOnCard(OBSIDIAN_CAGE_ID), IMPERIAL_WARBANDS)
    if (placement === undefined) {
        return `place the Obsidian Cage’s ${describeWarbands(caged, IMPERIAL_WARBANDS)} on Imperial boards`
    }
    const named = new Set<string>()
    for (const { playerId, count } of placement) {
        if (named.has(playerId)) return `${playerId}'s board is named twice`
        named.add(playerId)
        if (!boards.includes(playerId)) return `${playerId}'s board is not an Imperial board`
        if (!Number.isInteger(count) || count < 1) {
            return `${playerId}'s board is named for ${count} warbands; a board named takes at least 1`
        }
    }
    const placed = placement.reduce((sum, { count }) => sum + count, 0)
    return placed === caged
        ? undefined
        : `place all ${caged} of the Obsidian Cage’s Imperial warbands, not ${placed}`
}

/**
 * R-10.13-H1 — the Cage's Q&A: as it goes to the relic deck its holder returns every caged warband
 * "as described on its Action power", each owner's to their one board, the Empire's as placed.
 */
export function cagedGroupsToBoards(
    state: HydratedOathGameState,
    placement: CagePlacement | undefined
): WarbandGroup[] {
    return warbandEntries(state.warbandsOnCard(OBSIDIAN_CAGE_ID))
        .filter(([, count]) => count > 0)
        .flatMap(([owner, count]): WarbandGroup[] => {
            const boards = cageBoardsFor(state, owner)
            // Checked by `reasonCagePlacementInvalid`; listed in seat order, as the boards are.
            const placed =
                owner === IMPERIAL_WARBANDS && boards.length > 1
                    ? boards.flatMap((playerId) =>
                          (placement ?? []).filter((entry) => entry.playerId === playerId)
                      )
                    : boards.slice(0, 1).map((playerId) => ({ playerId, count }))
            return placed.map(({ playerId, count: placedCount }) => ({
                at: { kind: 'board' as const, playerId },
                owner,
                count: placedCount
            }))
        })
}
