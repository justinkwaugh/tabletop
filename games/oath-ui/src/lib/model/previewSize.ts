import { CardKind, kindOf } from '@tabletop/oath'
import type { CardPreview } from './cardPreview.svelte.js'

// The source art's widths for the wide cards: a banner (920 x 460), a Vision's face
// (1016 x 651) and a site (770 x 596). Drawn no wider, they stay sharp (readiness gate 1).
const BANNER_SOURCE_WIDTH = 920
const VISION_SOURCE_WIDTH = 1016
const SITE_SOURCE_WIDTH = 770

export const UPRIGHT_PREVIEW_CAP = 460

export function previewSourceWidth(preview: CardPreview): number | undefined {
    if (preview.imageSrc) return preview.aspect === 2 ? BANNER_SOURCE_WIDTH : undefined
    if (preview.back !== undefined || !preview.cardId) return undefined
    const kind = kindOf(preview.cardId)
    if (kind === CardKind.Vision) return VISION_SOURCE_WIDTH
    if (kind === CardKind.Site) return SITE_SOURCE_WIDTH
    return undefined
}

export function previewWidth(
    area: { width: number; height: number },
    aspect: number,
    sourceWidth: number | undefined
): number {
    const cap = aspect > 1 && sourceWidth !== undefined ? sourceWidth : UPRIGHT_PREVIEW_CAP
    return Math.round(Math.min(area.width * 0.8, area.height * 0.82 * aspect, cap))
}
