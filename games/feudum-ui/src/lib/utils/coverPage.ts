import type { BoundingBox, RectangleDimensions } from '@tabletop/common'
/** 4:5 at twice the catalog's large card height, for `scripts/make-cover.mjs` to render. */
export const CoverSize = { width: 544, height: 680 } as const

type Token = (name: string) => string | undefined

const { width: Width, height: Height } = CoverSize

export interface PrintedTitle {
    readonly left: number
    readonly right: number
}

/** FEUDUM in its scrolled frame on the 2400 × 1618 box front, from the F's foot to the M's tail. */
export const BoxFrontTitle: PrintedTitle = { left: 495 / 2400, right: 1890 / 2400 }

export const TitleMargin = 16

/** A printed title is never cut: a wide source fills the height only when its title still fits. */
export function coverPlacement(source: RectangleDimensions, title?: PrintedTitle): BoundingBox {
    const fullWidth = Width / source.width
    const scale = title
        ? Math.max(
              fullWidth,
              Math.min(
                  Height / source.height,
                  (Width - 2 * TitleMargin) / ((title.right - title.left) * source.width)
              )
          )
        : fullWidth
    const width = source.width * scale
    const height = source.height * scale
    const centre = title ? ((title.left + title.right) / 2) * width : width / 2
    const x = Math.min(0, Math.max(Width - width, Width / 2 - centre))
    return { x, y: (Height - height) / 2, width, height }
}

export type CoverScene =
    | { href: string; titled: false; size: RectangleDimensions }
    | { href: string; titled: true; size: RectangleDimensions; title?: PrintedTitle }

/** Sized here, not by `preserveAspectRatio="slice"`, which browsers draw differently. */
export function coverFill(source: RectangleDimensions): BoundingBox {
    const scale = Math.max(Width / source.width, Height / source.height)
    const width = source.width * scale
    const height = source.height * scale
    return { x: (Width - width) / 2, y: (Height - height) / 2, width, height }
}

function titleBand(token: Token) {
    return `
    <rect y="478" width="${Width}" height="150" fill="${token('parchment')}" />
    <rect y="478" width="${Width}" height="5" fill="${token('parchment-shade')}" />
    <rect y="623" width="${Width}" height="5" fill="${token('parchment-shade')}" />
    <text x="${Width / 2}" y="592" text-anchor="middle" font-size="124" fill="${token('ink')}"
        font-family="MedievalSharp, 'IM Fell English', serif">Feudum</text>`
}

export function coverSvg(scene: CoverScene, token: Token): string {
    const band = scene.titled ? '' : titleBand(token)
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${Width}" height="${Height}" viewBox="0 0 ${Width} ${Height}">
    ${ground(scene, token)}${band}
</svg>`
}

function ground(scene: CoverScene, token: Token): string {
    if (!scene.titled) {
        const { x, y, width, height } = coverFill(scene.size)
        return `<image href="${scene.href}" x="${x}" y="${y}" width="${width}" height="${height}" preserveAspectRatio="none" />`
    }
    const { x, y, width, height } = coverPlacement(scene.size, scene.title)
    const page =
        y > 0 ? `<rect width="${Width}" height="${Height}" fill="${token('surface')}" />` : ''
    return `${page}<image href="${scene.href}" x="${x}" y="${y}" width="${width}" height="${height}" preserveAspectRatio="none" />`
}
