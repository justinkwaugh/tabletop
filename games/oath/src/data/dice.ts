import type { Prng } from '@tabletop/common'
import type { RolledAttackFace, RolledDefenseFace } from '../model/campaign.js'

// The Law never prints the dice faces (R-1.1 only counts the dice); these are the components'.

const SWORD: RolledAttackFace = { swords: 1, hollowSwords: 0, skulls: 0 }
const HOLLOW_SWORD: RolledAttackFace = { swords: 0, hollowSwords: 1, skulls: 0 }
// The skull face prints two swords beside the skull.
const SKULL_AND_TWO_SWORDS: RolledAttackFace = { swords: 2, hollowSwords: 0, skulls: 1 }

const BLANK: RolledDefenseFace = { shields: 0, doubling: false }
const SHIELD: RolledDefenseFace = { shields: 1, doubling: false }
const TWO_SHIELDS: RolledDefenseFace = { shields: 2, doubling: false }
// The doubling face is a shield outline framing the glyph, not a filled shield.
const DOUBLING: RolledDefenseFace = { shields: 0, doubling: true }

export const ATTACK_DIE_FACES: readonly RolledAttackFace[] = [
    SKULL_AND_TWO_SWORDS,
    HOLLOW_SWORD,
    SWORD,
    HOLLOW_SWORD,
    SWORD,
    HOLLOW_SWORD
]

export const DEFENSE_DIE_FACES: readonly RolledDefenseFace[] = [
    BLANK,
    SHIELD,
    SHIELD,
    TWO_SHIELDS,
    BLANK,
    DOUBLING
]

/** R-5.5.5.a — hollow swords pair across the whole roll; skulls are returned, not applied. */
export function attackFromFaces(faces: readonly RolledAttackFace[]): {
    swords: number
    skulls: number
} {
    let swords = 0
    let hollowSwords = 0
    let skulls = 0

    for (const face of faces) {
        swords += face.swords
        hollowSwords += face.hollowSwords
        skulls += face.skulls
    }

    return { swords: swords + Math.floor(hollowSwords / 2), skulls }
}

/** R-5.5.4.a — doublings stack exponentially and apply to shields only, never warbands. */
export function defenseShieldsFromFaces(faces: readonly RolledDefenseFace[]): number {
    let shields = 0
    let doublings = 0

    for (const face of faces) {
        shields += face.shields
        if (face.doubling) {
            doublings += 1
        }
    }

    return shields * 2 ** doublings
}

/** Rolled from the protected stream in `apply()`, never in the hidden-info resolver. */
export function rollAttackDice(prng: Prng, count: number): RolledAttackFace[] {
    return rollFrom(ATTACK_DIE_FACES, prng, count)
}

export function rollDefenseDice(prng: Prng, count: number): RolledDefenseFace[] {
    return rollFrom(DEFENSE_DIE_FACES, prng, count)
}

// One PRNG invocation per die and none for an empty pool, so a replay consumes the same randomness.
function rollFrom<T>(faces: readonly T[], prng: Prng, count: number): T[] {
    return Array.from({ length: count }, () => faces[prng.randInt(faces.length)])
}

/** R-3.3 */
export const END_DIE_FACES: readonly number[] = [1, 2, 3, 4, 5, 6]

/** R-3.3; one PRNG invocation, so the calling action is not undoable (R-X.3). */
export function rollEndDie(prng: Prng): number {
    return prng.dieRoll(END_DIE_FACES.length)
}
