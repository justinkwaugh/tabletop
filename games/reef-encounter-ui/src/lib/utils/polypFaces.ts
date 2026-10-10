import type { CoralColor } from '@tabletop/reef-encounter'
import { PolypFaceUrls } from '$lib/images/art.generated.js'

// The rules never tell two polyps of a colour apart, so each shows one of its colour's painted
// faces, picked from where it lies so it looks the same on every screen and after a reload.
export function polypFaceUrl(color: CoralColor, place: string): string {
    const faces = PolypFaceUrls[color]
    return faces[fnv1a(place) % faces.length]
}

function fnv1a(text: string): number {
    let hash = 0x811c9dc5
    for (let index = 0; index < text.length; index++) {
        hash = Math.imul(hash ^ text.charCodeAt(index), 0x01000193) >>> 0
    }
    return hash
}
