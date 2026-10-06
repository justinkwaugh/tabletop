import { assertExists, type Color } from '@tabletop/common'
import { pieceFiles } from './imageManifest.generated.js'
import { imageNamed, indexByName, type SizedImage } from './manifestIndex.js'

// Cut onto one canvas so relative heights survive; callers set height, not width.
function byColor(kind: 'warband' | 'pawn'): Map<string, string> {
    const prefix = `${kind}.`
    return new Map(
        [...indexByName(pieceFiles)]
            .filter(([name]) => name.startsWith(prefix))
            .map(([name, url]) => [name.slice(prefix.length), url] as const)
    )
}

const warbandsByColor = byColor('warband')
const pawnsByColor = byColor('pawn')

export function warbandImage(color: Color): string {
    return imageNamed(warbandsByColor, color)
}

const WARBAND_HEIGHT = 97
const WARBAND_WIDTHS: ReadonlyMap<string, number> = new Map([
    ['black', 89],
    ['blue', 95],
    ['purple', 95],
    ['red', 92],
    ['white', 103],
    ['yellow', 95]
])

export function warbandFigure(color: Color): SizedImage {
    const width = WARBAND_WIDTHS.get(color)
    assertExists(width, `No warband width is recorded for ${color}`)
    return { src: warbandImage(color), width, height: WARBAND_HEIGHT }
}

export function warbandImageKeys(): string[] {
    return [...warbandsByColor.keys()]
}

export function pawnImage(color: Color): string {
    return imageNamed(pawnsByColor, color)
}

export function pawnImageKeys(): string[] {
    return [...pawnsByColor.keys()]
}

export { banditWarbandImage } from './banditFigure.js'
