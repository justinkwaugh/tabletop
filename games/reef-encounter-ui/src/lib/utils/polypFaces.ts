import type { CoralColor } from '@tabletop/reef-encounter'
import { PolypFaceUrls } from '$lib/images/art.generated.js'
import { fnv1a } from './hash.js'

// The rules never tell two polyps of a colour apart, so each shows one of its colour's painted
// faces, picked from where it lies so it looks the same on every screen and after a reload.
export function polypFaceUrl(color: CoralColor, place: string): string {
    const faces = PolypFaceUrls[color]
    return faces[fnv1a(place) % faces.length]
}
