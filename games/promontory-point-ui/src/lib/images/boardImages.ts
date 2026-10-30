import mapUrl from './board/map.webp'
import type { SizedImage } from './sizedImage.js'

// R-0 — the supplied map, resized from its 3571 × 2302 original.
export function mapImage(): SizedImage {
    return { src: mapUrl, width: 3100, height: 1998 }
}
