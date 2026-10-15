import type { CoralColor } from '@tabletop/reef-encounter'
import { PolypFaces } from '$lib/images/art.generated.js'
import { fnv1a } from './hash.js'

export type PolypFace = { url: string; mirrored: boolean }

// The rules never tell two polyps of a colour apart, so each shows one of its colour's painted
// faces, picked from where it lies so it looks the same on every screen and after a reload.
export function polypFace(color: CoralColor, place: string): PolypFace {
    const faces = PolypFaces[color]
    return faces[fnv1a(place) % faces.length]
}
