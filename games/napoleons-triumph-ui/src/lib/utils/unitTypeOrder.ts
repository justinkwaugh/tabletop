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
    const ranked = units.flatMap((unit) => (unit.face ? [{ unit, face: unit.face }] : []))
    return ranked.length === units.length
        ? ranked.toSorted((a, b) => byFaceRank(a.face, b.face)).map((entry) => entry.unit)
        : [...units]
}
