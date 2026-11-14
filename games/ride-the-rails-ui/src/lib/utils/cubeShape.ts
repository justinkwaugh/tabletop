import { getContext, setContext } from 'svelte'
import { assertExists } from '@tabletop/common'

/**
 * Art plan, Cube: an isometric wooden cube in its own units, 10 across and 10.6 high, centred on
 * the origin. Its top is a rhombus; its two sides hang below it.
 */
export const CUBE_UNITS = { width: 10, height: 10.6 } as const

/** A cube's height for its width: what a track slot leaves room for. */
export const CUBE_ASPECT = CUBE_UNITS.width / CUBE_UNITS.height

const TOP_Y = -2.8
const N = `0,${TOP_Y - 2.5}`
const E = `5,${TOP_Y}`
const S = `0,${TOP_Y + 2.5}`
const W = `-5,${TOP_Y}`
const E_LOW = `5,${TOP_Y + 5.6}`
const S_LOW = `0,${TOP_Y + 8.1}`
const W_LOW = `-5,${TOP_Y + 5.6}`

/** The whole cube's outline, which carries its colour and its edge. */
export const CUBE_OUTLINE = `${N} ${E} ${E_LOW} ${S_LOW} ${W_LOW} ${W}`
export const CUBE_TOP = `${N} ${E} ${S} ${W}`
export const CUBE_LEFT = `${W} ${S} ${S_LOW} ${W_LOW}`
export const CUBE_RIGHT = `${S} ${E} ${E_LOW} ${S_LOW}`

/** A few strokes of grain: two along the top's diagonal, two along each side. */
export const CUBE_GRAIN =
    'M-3.1 -3.4 Q-1 -3.7 0.9 -2.3 T3.4 -1.9 M-2.2 -2.1 Q-0.4 -2.6 1.5 -1.2 ' +
    'M-4.4 -0.9 Q-2.6 -0.3 -0.5 1.2 M-4.4 1 Q-2.4 2.1 -0.6 3.3 ' +
    'M0.6 1.8 Q2.4 0.4 4.4 -0.2 M0.6 3.9 Q2.8 2.6 4.4 2.1'

/** The light worn edge where the top meets the sides. */
export const CUBE_WORN_EDGE = `M-4.6 ${TOP_Y + 0.2} L0 ${TOP_Y + 2.5} L4.6 ${TOP_Y + 0.2}`

/** The railroad letter on the top, centred on the alphabetic baseline plus 0.35 em. */
export const CUBE_LETTER = { y: TOP_Y + 4.2 * 0.35, fontSize: 4.2 } as const

/** The icon's view box: the cube with room for its edge. */
export const CUBE_ICON_VIEW_BOX = '-6.2 -6.2 12.4 12.4'

/**
 * Below this size on screen a cube's letter would be a smudge, so it is left off; the cube's
 * colour, the railroad strip and the hex detail name the railroad there.
 */
export const LETTERED_CUBE_MIN_SCREEN_WIDTH = 13

export function cubeLettered(width: number, viewScale: number): boolean {
    return width * viewScale >= LETTERED_CUBE_MIN_SCREEN_WIDTH
}

/** The ids of the three gradients that shade a wooden cube: its top's sheen and its two sides. */
export type CubeShadingIds = { top: string; left: string; right: string }

const CUBE_SHADING = Symbol('rtr-cube-shading')

export function cubeShadingIds(prefix: string): CubeShadingIds {
    return { top: `${prefix}-top`, left: `${prefix}-left`, right: `${prefix}-right` }
}

/**
 * Called by each SVG that draws cubes (the board, the phone's flight layer, a cube icon), which
 * also draws `CubeShading` with the same prefix: every cube inside it shares those gradients.
 */
export function provideCubeShading(prefix: string): CubeShadingIds {
    const ids = cubeShadingIds(prefix)
    setContext(CUBE_SHADING, ids)
    return ids
}

export function cubeShading(): CubeShadingIds {
    const ids = getContext<CubeShadingIds | undefined>(CUBE_SHADING)
    assertExists(ids, 'A cube is drawn outside an SVG that provides its shading')
    return ids
}
