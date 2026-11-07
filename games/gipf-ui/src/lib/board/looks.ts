import { LOOK_URLS } from './lookUrls.js'
import type { Tone } from './pieceShape.js'

// Each tone's disc, pre-rendered to a file by scripts/render-looks.mjs.
export function lookUrl(tone: Tone): string {
    return LOOK_URLS[tone]
}
