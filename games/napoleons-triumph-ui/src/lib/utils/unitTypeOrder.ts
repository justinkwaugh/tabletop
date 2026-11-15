import { UnitType, isGuard, type Face, type ProjectedUnit } from '@tabletop/napoleons-triumph'

export const UNIT_TYPE_ORDER = [UnitType.Infantry, UnitType.Cavalry, UnitType.Artillery]

/** Guard, infantry, cavalry, artillery, and the strongest first within each. */
export function byFaceRank(a: Face, b: Face): number {
    return (
        UNIT_TYPE_ORDER.indexOf(a.type) - UNIT_TYPE_ORDER.indexOf(b.type) ||
        Number(isGuard(b)) - Number(isGuard(a)) ||
        b.strength - a.strength
    )
}

/** Units in the order their owner reads them, which is possible only while every face among them is known; otherwise as given. */
export function inReadingOrder(units: readonly ProjectedUnit[]): ProjectedUnit[] {
    return units.every((unit) => unit.face)
        ? seenFacesFirst(units, (unit) => unit.face)
        : [...units]
}

/** The face-down units follow as given, so their order tells nothing. */
export function seenFacesFirst(
    units: readonly ProjectedUnit[],
    faceOf: (unit: ProjectedUnit) => Face | undefined
): ProjectedUnit[] {
    const seen: { unit: ProjectedUnit; face: Face }[] = []
    const unseen: ProjectedUnit[] = []
    for (const unit of units) {
        const face = faceOf(unit)
        if (face) {
            seen.push({ unit, face })
        } else {
            unseen.push(unit)
        }
    }
    return [
        ...seen.toSorted((a, b) => byFaceRank(a.face, b.face)).map((entry) => entry.unit),
        ...unseen
    ]
}
