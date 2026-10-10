import {
    UnitType,
    retreatLossGroups,
    retreatRoom,
    retreatingUnits,
    type HydratedNapoleonsTriumphGameState,
    type ProjectedUnit,
    type RetreatLossGroup
} from '@tabletop/napoleons-triumph'
import type { BattleDraft } from './battle.js'

/** A retreat as it stands: the player's picks, completed with the kindest choices for the rest. */
export interface RetreatDraft {
    units: ProjectedUnit[]
    groups: RetreatLossGroup[]
    /** Locales the retreat may reach, with the room each has. */
    room: Map<number, number>
    losses: Record<string, number>
    survivors: ProjectedUnit[]
    destinations: Record<string, number>
    kept: Record<string, string>
    lossesValid: boolean
}

function strengthOf(unit: ProjectedUnit): number {
    return unit.face?.strength ?? 0
}

function isArtillery(unit: ProjectedUnit): boolean {
    return unit.face?.type === UnitType.Artillery
}

/** Each group's steps taken where they cost no unit if possible, from the strongest units first. */
function suggestedLosses(
    state: HydratedNapoleonsTriumphGameState,
    groups: readonly RetreatLossGroup[]
): Record<string, number> {
    const result: Record<string, number> = {}
    for (const group of groups) {
        let owed = group.steps
        const order = group.unitIds
            .map((id) => state.unit(id))
            .toSorted((a, b) => strengthOf(b) - strengthOf(a))
        for (const unit of order) {
            const take = Math.min(owed, Math.max(0, strengthOf(unit) - 1))
            if (take > 0) {
                result[unit.id] = take
                owed -= take
            }
        }
        for (const unit of order) {
            const take = Math.min(owed, strengthOf(unit) - (result[unit.id] ?? 0))
            if (take > 0) {
                result[unit.id] = (result[unit.id] ?? 0) + take
                owed -= take
            }
        }
    }
    return result
}

/** Survivors go where the player sent them while there is room, the rest wherever room is greatest. */
function settleDestinations(
    survivors: readonly ProjectedUnit[],
    room: ReadonlyMap<number, number>,
    wanted: Readonly<Record<string, number>>
): Record<string, number> {
    const result: Record<string, number> = {}
    const free = new Map(room)
    for (const unit of survivors) {
        const chosen = wanted[unit.id]
        if (chosen !== undefined && (free.get(chosen) ?? 0) > 0) {
            result[unit.id] = chosen
            free.set(chosen, (free.get(chosen) ?? 0) - 1)
        }
    }
    for (const unit of survivors) {
        if (result[unit.id] !== undefined) {
            continue
        }
        const [best] = [...free].toSorted((a, b) => b[1] - a[1])
        if (best && best[1] > 0) {
            result[unit.id] = best[0]
            free.set(best[0], best[1] - 1)
        }
    }
    return result
}

export function retreatDraft(state: HydratedNapoleonsTriumphGameState, draft: BattleDraft): RetreatDraft {
    const units = retreatingUnits(state)
    const groups = retreatLossGroups(state)
    const room = retreatRoom(state)
    const losses =
        Object.keys(draft.allocation).length > 0 ? draft.allocation : suggestedLosses(state, groups)
    const survivors = units.filter(
        (unit) => !isArtillery(unit) && (losses[unit.id] ?? 0) < strengthOf(unit)
    )
    const destinations = settleDestinations(survivors, room, draft.destinations)
    const kept: Record<string, string> = {}
    for (const commanderId of new Set(survivors.flatMap((unit) => unit.commanderId ?? []))) {
        const corps = survivors.filter(
            (unit) => unit.commanderId === commanderId && destinations[unit.id] !== undefined
        )
        const chosen = corps.find((unit) => unit.id === draft.kept[commanderId]) ?? corps[0]
        if (chosen && corps.length > 1) {
            kept[commanderId] = chosen.id
        }
    }
    const lossesValid = groups.every(
        (group) => group.unitIds.reduce((sum, id) => sum + (losses[id] ?? 0), 0) === group.steps
    )
    return { units, groups, room, losses, survivors, destinations, kept, lossesValid }
}
