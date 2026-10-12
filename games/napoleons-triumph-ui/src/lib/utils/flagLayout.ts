import type { BoundingBox, Point } from '@tabletop/common'
import { UnitType, commanderDefinition, type Face } from '@tabletop/napoleons-triumph'
import { APPROACH_GEOMETRY } from '$lib/map/boardGeometry.js'
import type { ArmyColors } from './armyColors.js'
import { attackMarkerSamples, attackMarkerScale } from './attackMarker.js'
import { screenAxes } from './boardView.js'
import { boxHolds } from './boundingBox.js'
import { blockSamples, type BlockFootprint } from './blockShape.js'
import type { GroupSprite, PieceGroup } from './pieceLayout.js'

export const STAFF_HEIGHT = 30
export const BANNER_HEIGHT = 18
export const TALLY_WIDTH = 27
const TALLY_TYPES = [UnitType.Infantry, UnitType.Cavalry, UnitType.Artillery]
const SAMPLE_STEP = 12
const STAFF_HALF_WIDTH = 2
const KEEP_CLEAR_WEIGHT = 4

export enum FlagSide {
    Right = 'right',
    Left = 'left'
}

export interface Tally {
    type: UnitType
    count: number
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

export function talliesOf(faces: Face[], unitCount: number): Tally[] {
    if (faces.length !== unitCount) {
        return []
    }
    return TALLY_TYPES.map((type) => ({
        type,
        count: faces.filter((face) => face.type === type).length
    })).filter((tally) => tally.count > 0)
}

// Workaround: no text can be measured where the banner's width is needed, so these are the advances of 13px italic Libre Baskerville as the browser reports them.
const GLYPH_ADVANCES: Record<number, string> = {
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
}
const UNLISTED_GLYPH_ADVANCE = 8
export const NAME_INSET = 11
const NAME_GAP = 9

function textWidth(text: string): number {
    const advances = Object.entries(GLYPH_ADVANCES)
    return [...text].reduce((width, glyph) => {
        const listed = advances.find(([, glyphs]) => glyphs.includes(glyph))
        return width + (listed ? Number(listed[0]) : UNLISTED_GLYPH_ADVANCE)
    }, 0)
}

export function nameWidth(name: string): number {
    return NAME_INSET + textWidth(name) + NAME_GAP
}

export function bannerWidth(name: string, tallyCount: number): number {
    return nameWidth(name) + (tallyCount > 0 ? tallyCount * TALLY_WIDTH + 6 : 16)
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
    keepClear: Point[] = []
): Record<string, FlagPlacement> {
    const { right, down } = screenAxes(view.rotation)
    const onScreen = (point: Point): Point => ({
        x: point.x * right.x + point.y * right.y,
        y: point.x * down.x + point.y * down.y
    })
    const taken = blocks.flatMap(blockSamples).map(onScreen)
    const prized = keepClear.map(onScreen)
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
            return under(taken) + under(prized) * KEEP_CLEAR_WEIGHT
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
    tallies: Tally[]
    hasCommanded: boolean
}

export interface FlagBearer {
    colors: ArmyColors
    visibleFaces: Face[]
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
    planted: readonly PlantedFlag[] = []
): FlagMark[] {
    const carried = sprites.flatMap((sprite) => {
        const { commander, units, key } = sprite.group
        if (!commander || !sprite.flagFeetByPreference) {
            return []
        }
        const { colors, visibleFaces, hasCommanded } = bearerOf(sprite.group)
        return {
            key,
            feetByPreference: sprite.flagFeetByPreference,
            name: commanderDefinition(commander.id).name,
            colors,
            count: units.length,
            tallies: talliesOf(visibleFaces, units.length),
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
            tallies: [],
            hasCommanded: false
        }))
    ]
    const placements = placeFlags(
        standing.map(({ key, feetByPreference, name, tallies }) => ({
            key,
            feetByPreference,
            width: bannerWidth(name, tallies.length)
        })),
        sprites.flatMap((sprite) => sprite.blocks),
        view,
        keepClear
    )
    return standing.map(({ feetByPreference: _feet, ...flag }) => ({
        ...flag,
        at: placements[flag.key].foot,
        side: placements[flag.key].side
    }))
}
