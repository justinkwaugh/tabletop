import { range } from '@tabletop/common'
import {
    forceTotal,
    type WarbandGroup,
    type WarbandLocation,
    type WarbandOwner
} from '@tabletop/oath'

export type ConversionKind = 'enough' | 'short' | 'none'

/** R-6.6.2, R-9.3 — the Exile's warbands, how many the Empire replaces, and how many leave play. */
export type Conversion = {
    kind: ConversionKind
    warbands: number
    imperial: number
    removed: number
}

export function citizenshipConversion(
    groups: readonly WarbandGroup[],
    imperialAvailable: number
): Conversion {
    const warbands = forceTotal(groups)
    const imperial = Math.min(imperialAvailable, warbands)
    const kind: ConversionKind =
        imperial === warbands ? 'enough' : imperial === 0 ? 'none' : 'short'
    return { kind, warbands, imperial, removed: warbands - imperial }
}

export type WarbandPiece = { key: string; owner: WarbandOwner }
export type PiecePlace = { at: WarbandLocation; pieces: WarbandPiece[] }

function locationKey(at: WarbandLocation): string {
    return at.kind === 'site' ? `site:${at.siteId}` : `board:${at.playerId}`
}

function pieceKeysOf(group: WarbandGroup): string[] {
    return range(0, group.count).map((index) => `${locationKey(group.at)}:${group.owner}:${index}`)
}

/** One piece per warband, grouped by place in the engine's order: the board, then the map. */
export function piecesByPlace(groups: readonly WarbandGroup[]): PiecePlace[] {
    const places: PiecePlace[] = []
    for (const group of groups) {
        const pieces = pieceKeysOf(group).map((key) => ({ key, owner: group.owner }))
        const last = places.at(-1)
        if (last && locationKey(last.at) === locationKey(group.at)) {
            last.pieces.push(...pieces)
        } else {
            places.push({ at: group.at, pieces })
        }
    }
    return places
}

/** R-9.3 — a tap on a picked piece untaps it; at the limit a tap on another swaps out the oldest. */
export function pickPiece(picked: readonly string[], key: string, limit: number): string[] {
    if (picked.includes(key)) return picked.filter((pickedKey) => pickedKey !== key)
    const next = [...picked, key]
    return next.length > limit ? next.slice(next.length - limit) : next
}

/** The picked pieces as the warband groups the engine reads, in the groups' order. */
export function replacementGroups(
    groups: readonly WarbandGroup[],
    picked: readonly string[]
): WarbandGroup[] {
    return groups
        .map((group) => ({
            ...group,
            count: pieceKeysOf(group).filter((key) => picked.includes(key)).length
        }))
        .filter((group) => group.count > 0)
}
