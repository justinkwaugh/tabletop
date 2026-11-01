import { LOOK_URLS } from './lookUrls.js'
import { lookName, type Disc } from './pieceShape.js'

// Every disc's look, pre-rendered to a file by scripts/render-looks.mjs.
export function lookUrl(disc: Disc): string {
    return LOOK_URLS[lookName(disc)]
}
