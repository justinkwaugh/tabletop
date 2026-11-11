/**
 * The catalog cover's page, composed for `scripts/make-cover.mjs` to render: 4:5 at twice the large
 * card's height, with the title band the script draws over a scene that has no title of its own. It
 * takes its colours from a token lookup, so it holds no raw colour.
 */
export const CoverSize = { width: 544, height: 680 } as const

type Token = (name: string) => string | undefined

const { width: Width, height: Height } = CoverSize

/** An image's size, in its own pixels. */
export interface ImageSize {
    readonly width: number
    readonly height: number
}

/** Where an image stands on the cover, in the cover's units; parts outside it are cropped. */
export interface CoverPlacement {
    readonly x: number
    readonly y: number
    readonly width: number
    readonly height: number
}

/** Where a cover's printed title runs across it, as fractions of the source's width. */
export interface PrintedTitle {
    readonly left: number
    readonly right: number
}

/**
 * The box front's printed title, FEUDUM in its scrolled frame, measured on the 2400 × 1618 source:
 * from the foot of the F to the tail of the M.
 */
export const BoxFrontTitle: PrintedTitle = { left: 495 / 2400, right: 1890 / 2400 }

/** The clear space the crop keeps on either side of a printed title, in the cover's units. */
export const TitleMargin = 16

/**
 * The crop rule for a cover that prints its own title. Without the title's place, the image is
 * scaled to the cover's full width, so a title printed across it is never cut at the sides, and
 * centred top to bottom: a source taller than 4:5 loses equal strips above and below, and a wider
 * one stands whole between two bands of the page's ground.
 *
 * With the title's place, a wide source such as the box front shows as much of its scene as the
 * title allows: it fills the cover's height when the title then fits between the margins, and
 * otherwise the title and its margins fill the width, with bands of ground above and below. The
 * title is centred across the cover unless that would show past the image's edge.
 */
export function coverPlacement(source: ImageSize, title?: PrintedTitle): CoverPlacement {
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

/**
 * What stands on the cover: the drawn scene's markup, or a supplied image. A supplied image that
 * prints its own title (`titled`) is the whole cover, placed by `coverPlacement` around that title
 * when its place is known; one without a
 * title fills the page behind the drawn title band, as the drawn scene does.
 */
export type CoverScene =
    | { kind: 'drawn'; markup: string }
    | { kind: 'art'; href: string; titled: false }
    | { kind: 'art'; href: string; titled: true; size: ImageSize; title?: PrintedTitle }

function titleBand(token: Token) {
    return `
    <rect y="478" width="${Width}" height="150" fill="${token('parchment')}" />
    <rect y="478" width="${Width}" height="5" fill="${token('parchment-shade')}" />
    <rect y="623" width="${Width}" height="5" fill="${token('parchment-shade')}" />
    <text x="${Width / 2}" y="592" text-anchor="middle" font-size="124" fill="${token('ink')}"
        font-family="MedievalSharp, 'IM Fell English', serif">Feudum</text>`
}

/** The cover as one SVG of `CoverSize`. */
export function coverSvg(scene: CoverScene, token: Token): string {
    const band = scene.kind === 'art' && scene.titled ? '' : titleBand(token)
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${Width}" height="${Height}" viewBox="0 0 ${Width} ${Height}">
    ${ground(scene, token)}${band}
</svg>`
}

function ground(scene: CoverScene, token: Token): string {
    if (scene.kind === 'drawn') {
        return scene.markup
    }
    if (!scene.titled) {
        return `<image href="${scene.href}" width="${Width}" height="${Height}" preserveAspectRatio="xMidYMid slice" />`
    }
    const { x, y, width, height } = coverPlacement(scene.size, scene.title)
    const page =
        y > 0 ? `<rect width="${Width}" height="${Height}" fill="${token('surface')}" />` : ''
    return `${page}<image href="${scene.href}" x="${x}" y="${y}" width="${width}" height="${height}" preserveAspectRatio="none" />`
}
