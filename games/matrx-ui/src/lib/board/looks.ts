import { LOOK_URLS } from './lookUrls.js'
import { lookName, type Disc } from './pieceShape.js'

export function lookUrl(disc: Disc): string {
    return LOOK_URLS[lookName(disc)]
}
