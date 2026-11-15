import type { RolledAttackFace, RolledDefenseFace } from '@tabletop/oath'
import { plural } from '$lib/model/names.js'

/** R-5.5.5 — what a rolled attack face does, as its picture's words. */
export function attackFaceWords(face: RolledAttackFace): string {
    if (face.skulls > 0) return 'Skull and two swords — a warband of yours dies'
    if (face.hollowSwords > 0) return 'Hollow sword — two make one sword'
    return 'Sword'
}

/** R-5.5.4 — what a rolled defense face does, as its picture's words. */
export function defenseFaceWords(face: RolledDefenseFace): string {
    if (face.doubling) return 'Doubles the shields rolled'
    return face.shields === 0 ? 'Blank' : plural(face.shields, 'shield')
}
