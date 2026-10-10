import {
    UnitType,
    retreatLossGroups,
    retreatRoom,
    retreatingUnits,
    type HydratedNapoleonsTriumphGameState,
    type ProjectedUnit,
    type RetreatLossGroup
} from '@tabletop/napoleons-triumph'
import type { StagedSelectionState } from '@tabletop/frontend-components'
import { retreatSelection, type RetreatValues } from './battleSelection.js'

export interface RetreatPlan {
    units: ProjectedUnit[]
    groups: RetreatLossGroup[]
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
    wanted: Readonly<Record<string, number>>
): Record<string, number> {
    const result: Record<string, number> = {}
    const free = new Map(room)
    const send = (unit: ProjectedUnit, locale: number) => {
        result[unit.id] = locale
        free.set(locale, (free.get(locale) ?? 0) - 1)
    }
    for (const unit of survivors) {
        const chosen = wanted[unit.id]
        if (chosen !== undefined && (free.get(chosen) ?? 0) > 0) {
            send(unit, chosen)
        }
    }
    for (const unit of survivors.filter((candidate) => result[candidate.id] === undefined)) {
        const [roomiest] = [...free].toSorted((a, b) => b[1] - a[1])
        if (roomiest && roomiest[1] > 0) {
            send(unit, roomiest[0])
        }
    }
    return result
}

export function retreatPlan(
    state: HydratedNapoleonsTriumphGameState,
    selection: StagedSelectionState<RetreatValues>
): RetreatPlan {
    const units = retreatingUnits(state)
    const groups = retreatLossGroups(state)
    const room = retreatRoom(state)
    const losses = retreatSelection.value(selection, 'losses') ?? suggestedLosses(state, groups)
    const survivors = units.filter(
        (unit) =>
            unit.face?.type !== UnitType.Artillery && (losses[unit.id] ?? 0) < strengthOf(unit)
    )
    const destinations = settleDestinations(
        survivors,
        room,
        retreatSelection.value(selection, 'destinations') ?? {}
    )
    const wantedKept = retreatSelection.value(selection, 'kept') ?? {}
    const kept: Record<string, string> = {}
    for (const commanderId of new Set(survivors.flatMap((unit) => unit.commanderId ?? []))) {
        const corps = survivors.filter(
            (unit) => unit.commanderId === commanderId && destinations[unit.id] !== undefined
        )
        const chosen = corps.find((unit) => unit.id === wantedKept[commanderId]) ?? corps[0]
        if (chosen && corps.length > 1) {
            kept[commanderId] = chosen.id
        }
    }
    const lossesValid = groups.every(
        (group) => group.unitIds.reduce((sum, id) => sum + (losses[id] ?? 0), 0) === group.steps
    )
    return { units, groups, room, losses, survivors, destinations, kept, lossesValid }
}
