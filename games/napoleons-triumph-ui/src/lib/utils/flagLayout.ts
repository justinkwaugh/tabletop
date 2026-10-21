import type { BoundingBox, Point } from '@tabletop/common'
import { commanderDefinition } from '@tabletop/napoleons-triumph'
import { APPROACH_GEOMETRY } from '$lib/map/boardGeometry.js'
import type { ArmyColors } from './armyColors.js'
import { attackMarkerSamples, attackMarkerScale } from './attackMarker.js'
import { screenAxes } from './boardView.js'
import { boxHolds } from './boundingBox.js'
import { blockSamples, type BlockFootprint } from './blockShape.js'
import type { GroupSprite, PieceGroup } from './pieceLayout.js'
import { textWidth, type GlyphAdvances } from './textWidth.js'

export const STAFF_HEIGHT = 30
export const BANNER_HEIGHT = 18
const SAMPLE_STEP = 12
const STAFF_HALF_WIDTH = 2
const KEEP_CLEAR_WEIGHT = 4

export enum FlagSide {
    Right = 'right',
    Left = 'left'
}

export interface StandingFlag {
    key: string
    feetByPreference: Point[]
    width: number
}

export interface FlagPlacement {
    foot: Point
    side: FlagSide
}

export interface FlagView {
    rotation: number
    scale: number
}

export function flagScale(zoom: number): number {
    return Math.min(3.2, Math.max(1, 0.62 / zoom))
}

// These are the advances of 13px italic Libre Baskerville.
const NAME_ADVANCES: GlyphAdvances = {
    listed: {
        3: '.',
        4: 'fijl ',
        5: 'stI',
        6: 'cerè',
        7: 'abghkopqyzJ',
        8: 'dnuvxS',
        9: 'CFLPYZ',
        10: 'ABERTVX',
        11: 'mwDGKNOQU',
        12: 'H',
        13: 'M',
        14: 'W'
    },
    unlisted: 8
}
export const NAME_INSET = 11
const NAME_GAP = 9
const COUNT_ROOM = 16

export function bannerWidth(name: string): number {
    return NAME_INSET + textWidth(name, NAME_ADVANCES) + NAME_GAP + COUNT_ROOM
}

function steps(from: number, to: number): number[] {
    const count = Math.max(1, Math.ceil((to - from) / SAMPLE_STEP))
    return Array.from({ length: count + 1 }, (_, index) => from + ((to - from) * index) / count)
}

function bannerSamples(banner: BoundingBox): Point[] {
    return steps(banner.x, banner.x + banner.width).flatMap((x) =>
        steps(banner.y, banner.y + banner.height).map((y) => ({ x, y }))
    )
}

function staffOf(foot: Point, scale: number): BoundingBox {
    return {
        x: foot.x - STAFF_HALF_WIDTH,
        y: foot.y - STAFF_HEIGHT * scale,
        width: STAFF_HALF_WIDTH * 2,
        height: STAFF_HEIGHT * scale
    }
}

export function placeFlags(
    flags: StandingFlag[],
    blocks: BlockFootprint[],
    view: FlagView,
    keepClear: Point[] = [],
    printedMarks: Point[][] = []
): Record<string, FlagPlacement> {
    const { right, down } = screenAxes(view.rotation)
    const onScreen = (point: Point): Point => ({
        x: point.x * right.x + point.y * right.y,
        y: point.x * down.x + point.y * down.y
    })
    const taken = blocks.flatMap(blockSamples).map(onScreen)
    const prized = keepClear.map(onScreen)
    const marks = printedMarks.map((mark) => mark.map(onScreen))
    const placements: Record<string, FlagPlacement> = {}
    for (const flag of flags) {
        const reach = flag.width * view.scale
        const bannerOf = ({ foot, side }: FlagPlacement): BoundingBox => {
            const at = onScreen(foot)
            return {
                x: side === FlagSide.Right ? at.x : at.x - reach,
                y: at.y - STAFF_HEIGHT * view.scale,
                width: reach,
                height: BANNER_HEIGHT * view.scale
            }
        }
        const covered = (placement: FlagPlacement) => {
            const footprint = [bannerOf(placement), staffOf(onScreen(placement.foot), view.scale)]
            const under = (points: Point[]) =>
                points.filter((point) => footprint.some((part) => boxHolds(part, point))).length
            const marksUnder = marks.filter((mark) => under(mark) > 0).length
            return under(taken) + (under(prized) + marksUnder) * KEEP_CLEAR_WEIGHT
        }
        const choices = flag.feetByPreference.flatMap((foot) =>
            [FlagSide.Right, FlagSide.Left].map((side) => ({ foot, side }))
        )
        const best = choices.reduce((chosen, choice) =>
            covered(choice) < covered(chosen) ? choice : chosen
        )
        placements[flag.key] = best
        taken.push(...bannerSamples(bannerOf(best)))
    }
    return placements
}

export interface FlagMark {
    key: string
    at: Point
    side: FlagSide
    name: string
    colors: ArmyColors
    count: number
    hasCommanded: boolean
}

/** The banner and the staff of a flag as it stands on the board. */
export function flagOutlines(flag: FlagMark, view: FlagView): Point[][] {
    const { right, down } = screenAxes(view.rotation)
    const onBoard = (across: number, up: number): Point => ({
        x: flag.at.x + right.x * across + down.x * up,
        y: flag.at.y + right.y * across + down.y * up
    })
    const reach = bannerWidth(flag.name) * view.scale * (flag.side === FlagSide.Left ? -1 : 1)
    const top = -STAFF_HEIGHT * view.scale
    const bottom = top + BANNER_HEIGHT * view.scale
    return [
        [onBoard(0, top), onBoard(reach, top), onBoard(reach, bottom), onBoard(0, bottom)],
        [
            onBoard(-STAFF_HALF_WIDTH, top),
            onBoard(STAFF_HALF_WIDTH, top),
            onBoard(STAFF_HALF_WIDTH, 0),
            onBoard(-STAFF_HALF_WIDTH, 0)
        ]
    ]
}

export interface FlagBearer {
    colors: ArmyColors
    hasCommanded: boolean
}

export function arrowsToKeepClear(approachIds: readonly number[], zoom: number): Point[] {
    const scale = attackMarkerScale(zoom)
    return approachIds.flatMap((approach) =>
        attackMarkerSamples(APPROACH_GEOMETRY[approach], scale)
    )
}

/** A commander's flag standing where its corps will set up, before the corps has any units to carry it. */
export interface PlantedFlag {
    commanderId: string
    at: Point
    colors: ArmyColors
}

export function flagMarks(
    sprites: readonly GroupSprite[],
    view: FlagView,
    keepClear: Point[],
    bearerOf: (group: PieceGroup) => FlagBearer,
    planted: readonly PlantedFlag[] = [],
    printedMarks: Point[][] = []
): FlagMark[] {
    const carried = sprites.flatMap((sprite) => {
        const { commander, units, key } = sprite.group
        if (!commander || !sprite.flagFeetByPreference) {
            return []
        }
        const { colors, hasCommanded } = bearerOf(sprite.group)
        return {
            key,
            feetByPreference: sprite.flagFeetByPreference,
            name: commanderDefinition(commander.id).name,
            colors,
            count: units.length,
            hasCommanded
        }
    })
    const standing = [
        ...carried,
        ...planted.map(({ commanderId, at, colors }) => ({
            key: `planted:${commanderId}`,
            feetByPreference: [at],
            name: commanderDefinition(commanderId).name,
            colors,
            count: 0,
            hasCommanded: false
        }))
    ]
    const placements = placeFlags(
        standing.map(({ key, feetByPreference, name }) => ({
            key,
            feetByPreference,
            width: bannerWidth(name)
        })),
        sprites.flatMap((sprite) => sprite.blocks),
        view,
        keepClear,
        printedMarks
    )
    return standing.map(({ feetByPreference: _feet, ...flag }) => ({
        ...flag,
        at: placements[flag.key].foot,
        side: placements[flag.key].side
    }))
}
