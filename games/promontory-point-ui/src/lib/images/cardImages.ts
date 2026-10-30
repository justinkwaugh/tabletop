import type { RailroadId } from '@tabletop/promontory-point'
import shareCp from './cards/share.cp.webp'
import shareUp from './cards/share.up.webp'
import shareKp from './cards/share.kp.webp'
import shareSp from './cards/share.sp.webp'
import type { SizedImage } from './sizedImage.js'

const SHARE_FACES: Record<RailroadId, string> = {
    'railroad.cp': shareCp,
    'railroad.up': shareUp,
    'railroad.kp': shareKp,
    'railroad.sp': shareSp
}

// R-1.1 — one supplied face per railroad's shares; the back is never shown (R-1.3).
export function shareFaceImage(railroadId: RailroadId): SizedImage {
    return { src: SHARE_FACES[railroadId], width: 675, height: 1050 }
}
