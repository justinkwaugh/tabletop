import type { Point } from '@tabletop/common'
import {
    ROUNDS,
    hourLabel,
    restingArtillery,
    type HydratedNapoleonsTriumphGameState,
    type RestingArtillery
} from '@tabletop/napoleons-triumph'
import { APPROACH_GEOMETRY } from '$lib/map/boardGeometry.js'
import { leftEndOf } from './approachPlates.js'
import { uprightAngle } from './boardView.js'
import { shortestClearSlide, type ConvexOutline } from './convexOutline.js'
import { BLOCK_SYMBOL_WIDTH } from './faceLayout.js'
import { cornersOf, type OrientedBox } from './orientedBox.js'
import { textWidth, type GlyphAdvances } from './textWidth.js'

export const GUN_TAG_HEIGHT = 14
export const GUN_TAG_FONT_SIZE = 11
export const GUN_TAG_STRIPE = 4
export const GUN_TAG_PADDING = 4
export const GUN_TAG_TEXT_LEFT = GUN_TAG_STRIPE + GUN_TAG_PADDING * 2 + BLOCK_SYMBOL_WIDTH
// Wide enough for the colours of the bar to show between two armies' tags.
const GAP_BETWEEN = 12
const CLEAR_OF_ARROWS = 1.5

// These are the advances of 11px Libre Baskerville.
const HOUR_ADVANCES: GlyphAdvances = {
    listed: {
        2.6: ': i',
        5.2: '1457aert',
        7.8: '0235689RdyAPgFh',
        10.4: 'N',
        13: 'M'
    },
    unlisted: 7.8
}

export interface GunTag {
    approach: number
    playerId?: string
    /** The hour the guns may fire again, or that they fired when the game ends first. */
    text: string
    /** Turned so its text reads the right way up. */
    angle: number
    box: OrientedBox
}

interface SizedTag {
    guns: RestingArtillery
    text: string
    width: number
}

function sizedTag(state: HydratedNapoleonsTriumphGameState, guns: RestingArtillery): SizedTag {
    const definition = ROUNDS[state.scenario][guns.ready]
    const text = definition ? hourLabel(definition, { minutes: false }) : 'Fired'
    return {
        guns,
        text,
        width: GUN_TAG_TEXT_LEFT + textWidth(text, HOUR_ADVANCES) + GUN_TAG_PADDING
    }
}

function alongBar(approach: number): Point {
    const radians = (APPROACH_GEOMETRY[approach].angle * Math.PI) / 180
    return { x: Math.cos(radians), y: Math.sin(radians) }
}

/** The approach that names the bar, of the two that cross it. */
function barOf(state: HydratedNapoleonsTriumphGameState, approach: number): number {
    const { locale, neighbour } = state.map.approach(approach)
    return Math.min(approach, state.map.approachBetween(neighbour, locale).id)
}

/**
 * Side by side on the bar between the two armies' front ranks, a tag alone in the middle. Each
 * army's tag takes the side of the middle to its right as its guns face across, and the row
 * slides along the bar by as little as takes it out from under the arrows.
 */
function placeOnBar(
    bar: number,
    tags: readonly SizedTag[],
    rotation: number,
    arrows: readonly ConvexOutline[]
): GunTag[] {
    const { centre } = APPROACH_GEOMETRY[bar]
    const along = alongBar(bar)
    const rightward = ({ guns }: SizedTag) => {
        const own = alongBar(guns.attackApproach)
        const leftEnd = leftEndOf(APPROACH_GEOMETRY[guns.attackApproach])
        return -leftEnd * (own.x * along.x + own.y * along.y)
    }
    const row = tags.toSorted((a, b) => rightward(a) - rightward(b))
    const length = row.reduce((total, tag) => total + tag.width, 0) + GAP_BETWEEN * (row.length - 1)
    const slide = shortestClearSlide(
        cornersOf({
            centre,
            along,
            halfLength: length / 2 + CLEAR_OF_ARROWS,
            halfWidth: GUN_TAG_HEIGHT / 2 + CLEAR_OF_ARROWS
        }),
        arrows,
        along
    )
    let start = slide - length / 2
    return row.map(({ guns, text, width }) => {
        const middle = start + width / 2
        start += width + GAP_BETWEEN
        return {
            approach: guns.attackApproach,
            playerId: guns.playerId,
            text,
            angle: uprightAngle(APPROACH_GEOMETRY[guns.attackApproach].angle, rotation),
            box: {
                centre: { x: centre.x + along.x * middle, y: centre.y + along.y * middle },
                along,
                halfLength: width / 2,
                halfWidth: GUN_TAG_HEIGHT / 2
            }
        }
    })
}

export function gunTags(
    state: HydratedNapoleonsTriumphGameState,
    rotation: number,
    arrows: readonly ConvexOutline[]
): GunTag[] {
    const bars = new Map<number, SizedTag[]>()
    for (const guns of restingArtillery(state)) {
        const bar = barOf(state, guns.attackApproach)
        bars.set(bar, [...(bars.get(bar) ?? []), sizedTag(state, guns)])
    }
    return [...bars].flatMap(([bar, tags]) => placeOnBar(bar, tags, rotation, arrows))
}
