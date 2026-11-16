import { LOOK_URLS } from './lookUrls.js'
import { lookName, type Look } from './pieceShape.js'

// Every piece's look, pre-rendered to a file by scripts/render-looks.mjs.
export function lookUrl(look: Look): string {
    return LOOK_URLS[lookName(look)]
}
