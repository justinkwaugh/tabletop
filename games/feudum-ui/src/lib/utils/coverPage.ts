/**
 * The catalog cover's page, composed for `scripts/make-cover.mjs` to render: 4:5 at twice the large
 * card's height, with the title band the script draws over a scene that has no title of its own. It
 * takes its colours from a token lookup, so it holds no raw colour.
 */
export const CoverSize = { width: 544, height: 680 } as const

/**
 * What stands on the cover: the drawn scene's markup, or a supplied image. A supplied image that
 * prints its own title (`titled`) is the whole cover; one without a title stands behind the drawn
 * title band, as the drawn scene does.
 */
export type CoverScene =
    { kind: 'drawn'; markup: string } | { kind: 'art'; href: string; titled: boolean }

type Token = (name: string) => string | undefined

const { width: Width, height: Height } = CoverSize

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
    const ground =
        scene.kind === 'art'
            ? `<image href="${scene.href}" width="${Width}" height="${Height}" preserveAspectRatio="xMidYMid slice" />`
            : scene.markup
    const band = scene.kind === 'art' && scene.titled ? '' : titleBand(token)
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${Width}" height="${Height}" viewBox="0 0 ${Width} ${Height}">
    ${ground}${band}
</svg>`
}
