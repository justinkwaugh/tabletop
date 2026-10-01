import type { RolledAttackFace, RolledDefenseFace } from '@tabletop/oath'
import { diceFiles } from './imageManifest.generated.js'
import { imageNamed, indexByName } from './manifestIndex.js'

// R-5.5.4, R-5.5.5 — keyed by what the face contributes, not by its index in the face table.
const byName = indexByName(diceFiles)

export function attackFaceImage(face: RolledAttackFace): string {
    if (face.skulls > 0) return imageNamed(byName, 'attack.skull')
    if (face.hollowSwords > 0) return imageNamed(byName, 'attack.hollow-sword')
    return imageNamed(byName, 'attack.sword')
}

export function defenseFaceImage(face: RolledDefenseFace): string {
    if (face.doubling) return imageNamed(byName, 'defense.doubling')
    if (face.shields >= 2) return imageNamed(byName, 'defense.two-shields')
    if (face.shields === 1) return imageNamed(byName, 'defense.shield')
    return imageNamed(byName, 'defense.blank')
}

export function attackDieBlank(): string {
    return imageNamed(byName, 'attack.sword')
}

// R-3.3 — the end die's face for a roll of `value`.
export function endDieImage(value: number): string {
    return imageNamed(byName, `end.${value}`)
}

export function diceImageKeys(): string[] {
    return [...byName.keys()]
}
