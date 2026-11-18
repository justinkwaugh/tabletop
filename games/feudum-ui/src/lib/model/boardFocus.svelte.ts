import {
    EpicVoyageTrack,
    GuildIds,
    MilitaryServiceTrack,
    type HydratedFeudumGameState
} from '@tabletop/feudum'
import {
    BoardHeight,
    BoardWidth,
    DiscFrame,
    GuildAreaHeight,
    GuildAreas,
    GuildAreaWidth,
    MapArea,
    ServiceSpaces,
    SpaceCentres,
    StackCentres,
    VoyageSpaces,
    railOverRect,
    StandingsStrip,
    standingsStripHeight,
    stripRailDrawingHeight,
    westGuild,
    type Point
} from '$lib/utils/boardGeometry.js'
import type { BoardOffer, BoardTarget } from './boardOffer.js'

/**
 * The focus chooser's chips, a phone's: Map, West guilds, East guilds and Tracks (contract: Phone
 * layout). A desk has one view, the map, and the guilds behind its side buttons (Desk layout).
 */
export type FocusArea = 'map' | 'west' | 'east' | 'tracks'
export type FramedArea = Exclude<FocusArea, 'tracks'>
/** Where a pick's targets stand: an area of the board, or a track. */
export type PlacedArea = FocusArea
/** A desk's guild side, behind its button. */
export type GuildSide = 'west' | 'east'

export interface BoardRect {
    readonly x: number
    readonly y: number
    readonly width: number
    readonly height: number
}

/** What a pick asks the board to frame. The key is the lit set, so one pick frames once. */
export interface PickFrame {
    readonly key: string
    readonly rect: BoardRect
    /** A guild pick's column names its chip; the map's and a track's name none. */
    readonly area?: FramedArea
    /** Every area its targets stand in, so a desk knows whether one guild side holds them all. */
    readonly holds?: readonly PlacedArea[]
}

/** Below this fit the board's targets are too small to tap: a phone rests at a cover fit. */
export const CoverBelowScale = 0.2
/** The chips' height over the board's top edge, kept clear when the board rests or frames. */
export const ChooserInset = 36
/**
 * Contract, Symbol key and Supply: an empty band in board units under the board's frame, scaled
 * with it, so the zoom row (the zoom buttons, Key and Supply) stands under the frame and never over
 * the score track, at rest or zoomed to the lower edge. At the smallest scale the board rests at
 * when its height binds, a phone's cover fit, it still holds the 40 px row.
 */
export const ZoomRowBand = 128
/** What the scaling wrapper fits on a phone: the board and the band under it. */
export const ScaledHeight = BoardHeight + ZoomRowBand

/**
 * Contract, Desk layout: a guild side's button, its width and its gap to the map in screen pixels.
 * One stands at each side of the map; the gutter is what each takes from the view's width.
 */
export const SideButtonWidth = 45
export const SideButtonGap = 4
export const SideGutter = SideButtonWidth + SideButtonGap

/**
 * What the scaling wrapper fits on a desk: the map, the guild standings' strip and the band. The
 * board's view is this shape at the column's width less the two gutters, so the zoom row stands
 * right under the strip.
 */
export function deskScaledHeight(seats: number): number {
    return MapArea.height + standingsStripHeight(seats) + ZoomRowBand
}

/** A width and a height in screen pixels: a view, or the room the game column leaves it. */
export interface Size {
    readonly width: number
    readonly height: number
}

/**
 * Contract, Desk layout: the side column. Where the map's height binds, the guild standings and the
 * zoom row leave the space under the map and stand in a column right of the East button: the six
 * standings, the score line, then Key, Supply and the zoom buttons along its foot. One standing a row
 * the column is as wide as that row; two a row, as wide as two standings at their own size.
 */
export interface DeskColumn {
    readonly perRow: 1 | 2
    readonly width: number
}

/** The gap between the East button and the column. */
export const DeskColumnGap = 8
/** The column's width with one standing a row: the zoom buttons, Key and Supply in one row. */
export const DeskColumnWidth = 256
/** Between two standings in the column, down and across. */
export const DeskColumnRailGap = 4
/** The zoom row at the column's foot, the zoom buttons' height. */
export const DeskZoomRow = 36
/** The gaps over the zoom row and over the score line. */
export const DeskColumnSpacing = 6
/** The column's score line: two seats a line, each line this tall, within its padding and frame. */
export const DeskScoreLineRow = 24
export const DeskScoreLineFrame = 12
/** One standing a row while they keep this much of their own size; else two a row. */
export const MinColumnRailScale = 0.85

/** The column's height under its standings: the score line, the zoom row and their gaps. */
export function deskColumnFoot(seats: number): number {
    const scoreLine = Math.ceil(seats / 2) * DeskScoreLineRow + DeskScoreLineFrame
    return DeskZoomRow + 2 * DeskColumnSpacing + scoreLine
}

/**
 * The scale the column draws its standings at in this height: their own size where it fits, else as
 * large as fits, never larger. Each standing has a line per seat (`stripRailDrawingHeight`).
 */
export function columnRailScale(height: number, seats: number, perRow: 1 | 2): number {
    const rows = GuildIds.length / perRow
    const room = height - (rows - 1) * DeskColumnRailGap
    return Math.max(0, Math.min(1, room / (rows * stripRailDrawingHeight(seats))))
}

/** Screen pixels right of the East button's gutter: the column and its gap, if any. */
function besideOf(column: DeskColumn | undefined): number {
    return column ? DeskColumnGap + column.width : 0
}

/**
 * A desk's rest: with the strip, the map, the strip and the band contained between the gutters; with
 * the column, the map alone between the gutters and the column.
 */
export function deskRestScaleOf(
    viewWidth: number,
    viewHeight: number,
    seats: number,
    column?: DeskColumn
): number {
    return Math.min(
        (viewWidth - 2 * SideGutter - besideOf(column)) / MapArea.width,
        viewHeight / (column ? MapArea.height : deskScaledHeight(seats)),
        1
    )
}

/**
 * Contract, Desk layout: whether a desk stands its standings and zoom row in a column beside the map,
 * and how. Only the room decides it, the game column's width and the height the panel leaves it, never
 * the board view's own size, so each size has one layout and it never flips back and forth. The column
 * is taken only where its map comes out larger than the strip's: where the map's height binds and the
 * column fits in the width it leaves. One standing a row while they keep `MinColumnRailScale`.
 */
export function deskColumnOf(room: Size, seats: number): DeskColumn | undefined {
    const one = columnRailScale(room.height - deskColumnFoot(seats), seats, 1)
    const column: DeskColumn =
        one >= MinColumnRailScale
            ? { perRow: 1, width: DeskColumnWidth }
            : { perRow: 2, width: 2 * StandingsStrip.drawing.width + DeskColumnRailGap }
    const strip = deskRestScaleOf(room.width, room.height, seats)
    const beside = deskRestScaleOf(room.width, room.height, seats, column)
    return beside > strip ? column : undefined
}

/**
 * The board view's width with the column, in the page: the buttons, the map at its rest in the room
 * and the column, so the view ends with the column and the zoom buttons stand at its foot. Rounded up,
 * so the room's height, where it binds, stays what binds the wrapper's fit.
 */
export function deskColumnViewWidth(room: Size, seats: number, column: DeskColumn): number {
    const scale = Math.max(0, deskRestScaleOf(room.width, room.height, seats, column))
    return Math.min(
        room.width,
        Math.ceil(MapArea.width * scale + 2 * SideGutter + besideOf(column))
    )
}

/** The column's box in the view: at its right edge, the view's full height. */
export function deskColumnBox(view: Size, column: DeskColumn): BoardRect {
    return { x: view.width - column.width, y: 0, width: column.width, height: view.height }
}

/** Contract, Supply: the desk view's height at the column's width, before it gives way. */
export function deskViewHeight(viewWidth: number, seats: number): number {
    return (Math.max(0, viewWidth - 2 * SideGutter) * deskScaledHeight(seats)) / MapArea.width
}

/** Where a desk's map rests in its view, in screen pixels, and the gutters that hold it there. */
export interface DeskRest extends BoardRect {
    readonly scale: number
    /** Board units of empty content left of the map: a gutter at the rest's scale. */
    readonly gutter: number
    /** Board units of empty content right of it: the gutter, and the column's room if any. */
    readonly trail: number
}

/**
 * The map at a desk's rest. The content carries a gutter each side, so the wrapper's own contain fit
 * is the rest and leaves the buttons their room beside the map: at the view's left in the page, the
 * content centred in full screen, as the wrapper places it. With the column the content also carries
 * the column's room on the right; in full screen it is as wide as the view, so the column stands at
 * the view's right edge and the map is centred in the room left of it.
 */
export function deskMapAtRest(
    view: Size,
    seats: number,
    centred: boolean,
    column?: DeskColumn
): DeskRest {
    const scale = deskRestScaleOf(view.width, view.height, seats, column)
    if (!(scale > 0)) {
        // Not measured yet, or narrower than the two buttons: no map to stand beside.
        return { x: SideGutter, y: 0, width: 0, height: 0, scale: 0, gutter: 0, trail: 0 }
    }
    const width = MapArea.width * scale
    const beside = besideOf(column)
    const left = centred ? Math.max(0, (view.width - width - 2 * SideGutter - beside) / 2) : 0
    const fitted = column ? MapArea.height : deskScaledHeight(seats)
    const top = centred ? Math.max(0, (view.height - fitted * scale) / 2) : 0
    // The wrapper centres the strip's content itself; the column's fills the view, its slack inside.
    const inset = column ? left : 0
    return {
        x: left + SideGutter,
        y: top,
        width,
        height: MapArea.height * scale,
        scale,
        gutter: (SideGutter + inset) / scale,
        trail: (SideGutter + inset + beside) / scale
    }
}

/** The side a guild area's target stands on; none for any other target. */
export function guildSideOf(target: BoardTarget): GuildSide | undefined {
    const [kind, id] = target.split(':')
    if (kind !== 'guild') {
        return undefined
    }
    return GuildIds.some((guild) => guild === id && westGuild(guild)) ? 'west' : 'east'
}

/** What a desk's guild side does for a pick new to it: open a side, keep as it is, or close. */
export type GuildSideFollowing = GuildSide | 'keep' | undefined

/**
 * Contract, Pick framing: on a desk a pick opens a guild side when every target, and an open popup's
 * anchor, stands in that side's guild areas. One in both sides opens nothing and keeps a side opened
 * by hand; one with a target on the map, or a track, closes the side, as the pick's end does.
 */
export function guildSideFollowing(frame: PickFrame | undefined): GuildSideFollowing {
    const holds = frame?.holds ?? []
    const sides = holds.filter((area): area is GuildSide => area === 'west' || area === 'east')
    if (sides.length === 0 || sides.length < holds.length) {
        return undefined
    }
    return sides.length === 1 ? sides[0] : 'keep'
}

/** Contract, Pick framing: how far past its rest a pick may bring the board. */
export const PickFrameZoom = 2.5
/** Room in screen pixels round what is framed. */
const FramePadding = { x: 12, y: 12 }
/** Room in board units round a target's centre, for the piece, its ring and its chip. */
const TargetRoom = DiscFrame

const SpacePoints = new Map<string, Point>(Object.entries(SpaceCentres))
const StackPoints = new Map<string, Point>(Object.entries(StackCentres))

function unionOf(points: readonly Point[], room: number): BoardRect {
    const left = Math.min(...points.map(({ x }) => x)) - room
    const top = Math.min(...points.map(({ y }) => y)) - room
    const right = Math.max(...points.map(({ x }) => x)) + room
    const bottom = Math.max(...points.map(({ y }) => y)) + room
    return { x: left, y: top, width: right - left, height: bottom - top }
}

/** A guild column with its standing rails at the map's inner edge (contract: Guild standings). */
function columnOf(area: 'west' | 'east'): BoardRect {
    const guilds = GuildIds.filter((guild) => westGuild(guild) === (area === 'west'))
    const corners = guilds.flatMap((guild) => {
        const { x, y } = GuildAreas[guild]
        const rail = railOverRect(guild)
        return [
            { x, y },
            { x: x + GuildAreaWidth, y: y + GuildAreaHeight },
            { x: rail.x, y: rail.y },
            { x: rail.x + rail.width, y: rail.y + rail.height }
        ]
    })
    return unionOf(corners, 0)
}

/** What a chip frames: the map's area and each guild column. */
export function rectOfArea(area: FramedArea): BoardRect {
    return area === 'map' ? MapArea : columnOf(area)
}

/** The scale the board rests at in a view this size, as the scaling wrapper reckons it. */
export function restScaleOf(viewWidth: number, viewHeight: number): number {
    const across = viewWidth / BoardWidth
    const down = Math.max(1, viewHeight - ChooserInset) / ScaledHeight
    const contain = Math.min(across, down, 1)
    return contain >= CoverBelowScale ? contain : Math.min(Math.max(across, down), 1)
}

export function pickFrameScale(restScale: number): number {
    return restScale * PickFrameZoom
}

function pieceSpace(state: HydratedFeudumGameState, target: string): string | undefined {
    const [kind, id, n] = target.split(':')
    if (kind === 'monster') {
        return Object.entries(state.monsters).find(([monster]) => monster === id)?.[1].spaceId
    }
    return state.players
        .find(({ playerId }) => playerId === id)
        ?.pawns.find((pawn) => String(pawn.n) === n)?.spaceId
}

type Placed =
    | { readonly area: 'map'; readonly at?: Point }
    | { readonly area: 'west' | 'east' }
    | { readonly area: 'tracks'; readonly at?: Point }

/** R-1.2 Where on the board a target stands, by the board's own positions. */
function placeOf(state: HydratedFeudumGameState, target: BoardTarget): Placed {
    const [kind = '', id = ''] = target.split(':')
    switch (kind) {
        case 'guild': {
            return {
                area: GuildIds.some((guild) => guild === id && westGuild(guild)) ? 'west' : 'east'
            }
        }
        case 'voyage': {
            const space = EpicVoyageTrack.find((row) => String(row.space) === id)
            return { area: 'tracks', at: space && VoyageSpaces.get(space.id) }
        }
        case 'military': {
            const space = MilitaryServiceTrack.find((row) => String(row.space) === id)
            return { area: 'tracks', at: space && ServiceSpaces.get(space.id) }
        }
        case 'stack': {
            return { area: 'map', at: StackPoints.get(id) }
        }
        case 'pawn':
        case 'monster': {
            return { area: 'map', at: SpacePoints.get(pieceSpace(state, target) ?? '') }
        }
        default: {
            return { area: 'map', at: SpacePoints.get(id) }
        }
    }
}

function litTargets(offer: BoardOffer): BoardTarget[] {
    return [...offer.targets]
        .filter(([, { role }]) => role === 'lit')
        .map(([target]) => target)
        .toSorted()
}

/** Contract, Focus chooser: the areas holding a lit target, each chip's dot and each side button's. */
export function litAreasOf(
    state: HydratedFeudumGameState,
    offer: BoardOffer
): ReadonlySet<FocusArea> {
    return new Set(litTargets(offer).map((target) => placeOf(state, target).area))
}

/**
 * Contract, Pick framing: the lit targets on the map; else the guild column holding lit areas, the
 * West first when both do; else the lit track. An open popup's anchor stands with them, since a
 * popup shows only while its anchor is in view, and a guild's holds its own column. The offer and
 * the popup alone decide it, and it changes neither.
 */
export function pickFrameOf(
    state: HydratedFeudumGameState,
    offer: BoardOffer,
    popupAnchor?: BoardTarget
): PickFrame | undefined {
    const lit = litTargets(offer)
    const targets =
        popupAnchor && !lit.includes(popupAnchor) ? [...lit, popupAnchor].toSorted() : lit
    if (targets.length === 0) {
        return undefined
    }
    const key = targets.join(' ')
    const anchored = popupAnchor && placeOf(state, popupAnchor).area
    if (anchored === 'west' || anchored === 'east') {
        return { key, rect: columnOf(anchored), area: anchored, holds: [anchored] }
    }
    const placed = targets.map((target) => placeOf(state, target))
    const holds = [...new Set(placed.map(({ area }) => area))]
    const points = (area: 'map' | 'tracks') =>
        placed.flatMap((place) =>
            place.area === area && 'at' in place && place.at ? [place.at] : []
        )
    const onMap = points('map')
    if (onMap.length > 0) {
        return { key, rect: unionOf(onMap, TargetRoom), holds }
    }
    for (const area of ['west', 'east'] as const) {
        if (placed.some((place) => place.area === area)) {
            return { key, rect: columnOf(area), area, holds }
        }
    }
    const onTracks = points('tracks')
    return onTracks.length > 0 ? { key, rect: unionOf(onTracks, TargetRoom), holds } : undefined
}

/** The scaling wrapper's views, as this needs them. */
export interface BoardView {
    focusRect(
        rect: BoardRect,
        options: { maxScale: number; padding: { x: number; y: number }; animate: boolean }
    ): void
    fitToContent(options: { animate: boolean }): void
}

export interface BoardFocusSetting {
    readonly view: () => BoardView | undefined
    /** The board's rest in the view as it stands now. */
    readonly restScale: () => number
    /** Held sideways the board fits the chosen view by height, not the cover fit. */
    readonly sideways: () => boolean
    readonly animate: () => boolean
}

/**
 * A phone's board focus (contract: Shared visual state). The chooser or a map pick opening sets it;
 * a pan or zoom by hand clears it. A pick gives back the chip it found when it closes, unless a hand
 * took the view first. It never changes an offer. It rests on the map. A desk has none: its one view
 * is the map at the wrapper's own fit, which holds every map and track target.
 */
export class BoardFocus {
    /** The chip the board stands on, until a hand moves it. */
    chosen: FramedArea | undefined = $state('map')
    /** What the open pick has framed, until a hand or a chip takes the view. */
    framed: PickFrame | undefined = $state.raw(undefined)

    /** The lit set last framed, so a hand's pan stays until the lit set changes. */
    private followedKey: string | undefined

    constructor(private readonly setting: BoardFocusSetting) {}

    /** Which chip reads as chosen: while framed, only a guild column's. */
    get shown(): FramedArea | undefined {
        return this.framed ? this.framed.area : this.chosen
    }

    private options() {
        return {
            maxScale: pickFrameScale(this.setting.restScale()),
            padding: FramePadding,
            animate: this.setting.animate()
        }
    }

    /** The area the board rests on: the map, held upright. */
    private restsOn(area: FramedArea): boolean {
        return area === 'map' && !this.setting.sideways()
    }

    /** Frames a rect in board units. */
    private frame(rect: BoardRect) {
        this.setting.view()?.focusRect(rect, this.options())
    }

    private show(area: FramedArea) {
        if (this.restsOn(area)) {
            this.setting.view()?.fitToContent({ animate: this.setting.animate() })
        } else {
            this.frame(rectOfArea(area))
        }
    }

    /**
     * Puts the board back on what it stands on, on opening, when the phone turns, or when the view's
     * size changes with the panel; nothing over a hand's view.
     */
    settle() {
        if (this.framed) {
            this.frame(this.framed.rect)
        } else if (this.chosen) {
            this.show(this.chosen)
        }
    }

    choose(area: FramedArea) {
        this.framed = undefined
        this.chosen = area
        this.show(area)
    }

    handMoved() {
        this.chosen = undefined
        this.framed = undefined
    }

    /** Reads the open pick: frames a lit set new to it, and gives the view back when it closes. */
    follow(frame: PickFrame | undefined) {
        if (frame?.key === this.followedKey) {
            return
        }
        this.followedKey = frame?.key
        if (frame) {
            this.framed = frame
            this.frame(frame.rect)
        } else if (this.framed) {
            this.framed = undefined
            if (this.chosen) {
                this.show(this.chosen)
            }
        }
    }
}
