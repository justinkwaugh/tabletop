import {
    UnitType,
    retreatLossGroups,
    retreatRoom,
    retreatingUnits,
    type HydratedNapoleonsTriumphGameState,
    type ProjectedUnit,
    type RetreatLossGroup
} from '@tabletop/napoleons-triumph'
import type { RetreatArrangement, RetreatDestination } from './battleSelection.js'

export enum RetreatFate {
    GunsLost = 'GunsLost',
    Eliminated = 'Eliminated',
    NoRoom = 'NoRoom',
    Retreats = 'Retreats'
}

export interface RetreatingUnit {
    unit: ProjectedUnit
    fate: RetreatFate
    loss: number
    destination?: number
}

export interface AssignedLossGroup extends RetreatLossGroup {
    assigned: number
    /** Its steps can fall on its units in more than one way. */
    open: boolean
}

/** Rule 12: a retreat breaks a corps up. Its commander keeps one unit and goes where that unit goes; the rest retreat detached. */
export interface RetreatingCommander {
    commanderId: string
    unitId: string
    /** The units of his corps that retreat. With more than one of them, which he keeps is the player's to choose. */
    corpsUnitIds: string[]
    movable: boolean
}

export enum RetreatRowKind {
    Retreats = 'Retreats',
    NoRoom = 'NoRoom',
    Lost = 'Lost'
}

/** The retreating units as the panel lists them: by the locale they go to, then those with no room, then those lost whatever is done. */
export type RetreatRow =
    | { kind: RetreatRowKind.Retreats; locale: number; units: RetreatingUnit[]; full: boolean }
    | { kind: RetreatRowKind.NoRoom | RetreatRowKind.Lost; units: RetreatingUnit[] }

export interface RetreatPlan {
    units: RetreatingUnit[]
    groups: AssignedLossGroup[]
    room: Map<number, number>
    losses: Record<string, number>
    survivors: ProjectedUnit[]
    destinations: Record<string, number>
    asked: RetreatDestination[]
    stranded: number
    kept: Record<string, string>
    commanders: RetreatingCommander[]
    lossesValid: boolean
}

export function strengthOf(unit: ProjectedUnit): number {
    return unit.face?.strength ?? 0
}

function suggestedLosses(
    state: HydratedNapoleonsTriumphGameState,
    groups: readonly RetreatLossGroup[]
): Record<string, number> {
    const result: Record<string, number> = {}
    for (const group of groups) {
        let owed = group.steps
        const strongestFirst = group.unitIds
            .map((id) => state.unit(id))
            .toSorted((a, b) => strengthOf(b) - strengthOf(a))
        for (const spare of [1, 0]) {
            for (const unit of strongestFirst) {
                const taken = result[unit.id] ?? 0
                const take = Math.min(owed, Math.max(0, strengthOf(unit) - spare - taken))
                if (take > 0) {
                    result[unit.id] = taken + take
                    owed -= take
                }
            }
        }
    }
    return result
}

function settleDestinations(
    survivors: readonly ProjectedUnit[],
    room: ReadonlyMap<number, number>,
    asked: readonly RetreatDestination[]
): Record<string, number> {
    const result: Record<string, number> = {}
    const free = new Map(room)
    const send = (unitId: string, locale: number) => {
        result[unitId] = locale
        free.set(locale, (free.get(locale) ?? 0) - 1)
    }
    const retreats = (unitId: string) => survivors.some((unit) => unit.id === unitId)
    for (const { unitId, locale } of asked) {
        if (retreats(unitId) && result[unitId] === undefined && (free.get(locale) ?? 0) > 0) {
            send(unitId, locale)
        }
    }
    // Deliberate: the order is fixed before anyone is placed. Asking for the roomiest locale unit by unit parts a corps between two locales as their room draws level.
    const roomiestFirst = [...free].toSorted((a, b) => b[1] - a[1]).map(([locale]) => locale)
    for (const unit of survivors.filter((candidate) => result[candidate.id] === undefined)) {
        const locale = roomiestFirst.find((candidate) => (free.get(candidate) ?? 0) > 0)
        if (locale !== undefined) {
            send(unit.id, locale)
        }
    }
    return result
}

function fateWithoutRetreating(
    unit: ProjectedUnit,
    loss: number
): RetreatFate.GunsLost | RetreatFate.Eliminated | undefined {
    if (unit.face?.type === UnitType.Artillery) {
        return RetreatFate.GunsLost
    }
    return loss >= strengthOf(unit) ? RetreatFate.Eliminated : undefined
}

export function retreatPlan(
    state: HydratedNapoleonsTriumphGameState,
    arrangement: RetreatArrangement
): RetreatPlan {
    const retreating = retreatingUnits(state)
    const lossGroups = retreatLossGroups(state)
    const room = retreatRoom(state)
    const losses = arrangement.losses ?? suggestedLosses(state, lossGroups)
    const lossOf = (unitId: string) => losses[unitId] ?? 0
    const survivors = retreating.filter(
        (unit) => fateWithoutRetreating(unit, lossOf(unit.id)) === undefined
    )
    const asked = arrangement.destinations ?? []
    const destinations = settleDestinations(survivors, room, asked)
    const wantedKept = arrangement.kept ?? {}
    const commanders = [...new Set(survivors.flatMap((unit) => unit.commanderId ?? []))].flatMap(
        (commanderId) => {
            const corps = survivors.filter(
                (unit) => unit.commanderId === commanderId && destinations[unit.id] !== undefined
            )
            const chosen = corps.find((unit) => unit.id === wantedKept[commanderId]) ?? corps.at(0)
            return chosen
                ? {
                      commanderId,
                      unitId: chosen.id,
                      corpsUnitIds: corps.map((unit) => unit.id),
                      movable: corps.length > 1
                  }
                : []
        }
    )
    const kept = Object.fromEntries(
        commanders
            .filter((commander) => commander.movable)
            .map(({ commanderId, unitId }) => [commanderId, unitId])
    )
    const groups = lossGroups.map((group) => ({
        ...group,
        assigned: group.unitIds.reduce((sum, id) => sum + lossOf(id), 0),
        open:
            group.unitIds.length > 1 &&
            group.steps < group.unitIds.reduce((sum, id) => sum + strengthOf(state.unit(id)), 0)
    }))
    const units = retreating.map((unit) => {
        const loss = lossOf(unit.id)
        const destination = destinations[unit.id]
        return {
            unit,
            fate:
                fateWithoutRetreating(unit, loss) ??
                (destination === undefined ? RetreatFate.NoRoom : RetreatFate.Retreats),
            loss,
            destination
        }
    })
    return {
        units,
        groups,
        room,
        losses,
        survivors,
        destinations,
        asked,
        stranded: survivors.filter((unit) => destinations[unit.id] === undefined).length,
        kept,
        commanders,
        lossesValid: groups.every((group) => group.assigned === group.steps)
    }
}

/** The commander whose flag may be picked up, when the player has a choice of the unit he keeps. */
export function movableCommander(
    plan: RetreatPlan,
    commanderId: string | undefined
): RetreatingCommander | undefined {
    return plan.commanders.find(
        (commander) => commander.movable && commander.commanderId === commanderId
    )
}

export function retreatRows(plan: RetreatPlan): RetreatRow[] {
    const withFate = (fate: RetreatFate) => plan.units.filter((unit) => unit.fate === fate)
    const going: RetreatRow[] = [...plan.room].map(([locale, free]) => {
        const units = plan.units.filter((unit) => unit.destination === locale)
        return { kind: RetreatRowKind.Retreats, locale, units, full: units.length >= free }
    })
    const lost = plan.units.filter(
        (unit) => unit.fate === RetreatFate.GunsLost || unit.fate === RetreatFate.Eliminated
    )
    const rows: RetreatRow[] = [
        ...going,
        { kind: RetreatRowKind.NoRoom, units: withFate(RetreatFate.NoRoom) },
        { kind: RetreatRowKind.Lost, units: lost }
    ]
    return rows.filter((row) => row.units.length > 0)
}
