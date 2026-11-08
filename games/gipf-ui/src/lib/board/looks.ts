import { LOOK_URLS } from './lookUrls.js'
import type { Tone } from './pieceShape.js'

export function lookUrl(tone: Tone): string {
    return LOOK_URLS[tone]
}
