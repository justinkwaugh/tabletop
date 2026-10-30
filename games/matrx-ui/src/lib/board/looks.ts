import { lookName, type Disc } from './pieceShape.js'

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
