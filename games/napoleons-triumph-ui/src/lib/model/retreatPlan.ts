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
import { retreatSelection, type RetreatDestination, type RetreatValues } from './battleSelection.js'

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
    owesLoss: boolean
    destination?: number
}

export interface AssignedLossGroup extends RetreatLossGroup {
    assigned: number
}

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
    for (const unit of survivors.filter((candidate) => result[candidate.id] === undefined)) {
        const [roomiest] = [...free].toSorted((a, b) => b[1] - a[1])
        if (roomiest && roomiest[1] > 0) {
            send(unit.id, roomiest[0])
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
    selection: StagedSelectionState<RetreatValues>
): RetreatPlan {
    const retreating = retreatingUnits(state)
    const lossGroups = retreatLossGroups(state)
    const room = retreatRoom(state)
    const losses = retreatSelection.value(selection, 'losses') ?? suggestedLosses(state, lossGroups)
    const lossOf = (unitId: string) => losses[unitId] ?? 0
    const survivors = retreating.filter(
        (unit) => fateWithoutRetreating(unit, lossOf(unit.id)) === undefined
    )
    const asked = retreatSelection.value(selection, 'destinations') ?? []
    const destinations = settleDestinations(survivors, room, asked)
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
    const groups = lossGroups.map((group) => ({
        ...group,
        assigned: group.unitIds.reduce((sum, id) => sum + lossOf(id), 0)
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
            owesLoss: lossGroups.some((group) => group.unitIds.includes(unit.id)),
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
        lossesValid: groups.every((group) => group.assigned === group.steps)
    }
}
