import type { PieceKind } from '@tabletop/matrx'
import { DISC_LOOKS, lookName, type Disc } from './pieceShape.js'

// Every disc's look, pre-rendered to a file by scripts/render-looks.mjs.
const LOOK_URLS: Record<string, string> = Object.fromEntries(
    Object.entries(
        import.meta.glob<string>('../images/looks/*.webp', {
            eager: true,
            query: '?url',
            import: 'default'
        })
    ).map(([path, url]) => [path.replace(/^.*\/|\.webp$/g, ''), url])
)

export function lookUrl(disc: Disc): string {
    return LOOK_URLS[lookName(disc)]
}

// Fetches and decodes every look of the kinds given, so a disc can spin through them in flight
// without a frame drawn before its next look has loaded.
export function preloadLooks(kinds: readonly PieceKind[]) {
    if (typeof Image === 'undefined') return
    for (const disc of DISC_LOOKS.filter((look) => kinds.includes(look.kind))) {
        const image = new Image()
        image.src = lookUrl(disc)
        image.decode().catch(() => {})
    }
}
