import { UnitType, isGuard, isHeavyCavalry, type Face } from '@tabletop/napoleons-triumph'

export function faceName(face: Face): string {
    if (face.type === UnitType.Artillery) {
        return 'artillery'
    }
    if (isGuard(face)) {
        return 'guard infantry'
    }
    if (isHeavyCavalry(face)) {
        return 'heavy cavalry'
    }
    return `${face.strength}-strength ${face.type === UnitType.Infantry ? 'infantry' : 'cavalry'}`
}
