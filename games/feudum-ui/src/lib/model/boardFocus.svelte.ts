import {
    EpicVoyageTrack,
    GuildIds,
    MilitaryServiceTrack,
    type HydratedFeudumGameState
} from '@tabletop/feudum'
import {
    BoardHeight,
    BoardWidth,
    DeskBoardArea,
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
    standingsStripHeight,
    westGuild,
    type Point
} from '$lib/utils/boardGeometry.js'
import type { BoardOffer, BoardTarget } from './boardOffer.js'

/**
 * The focus chooser's chips: on a phone Map, West guilds, East guilds and Tracks (contract: Phone
 * layout); on a desk Whole board, Map, West guilds and East guilds (contract: Supply, the zoom row).
 */
export type FocusArea = 'board' | 'map' | 'west' | 'east' | 'tracks'
export type FramedArea = Exclude<FocusArea, 'tracks'>
/** Where a pick's targets stand: an area of the board, or a track. */
export type PlacedArea = Exclude<FocusArea, 'board'>

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
    /** Every area its targets stand in, so a desk knows whether its chosen view holds them. */
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
 * What it fits on a desk: the board, the guild standings' strip and the band. The board's view is
 * this shape at the column's width, so the zoom row stands right under the strip.
 */
export function deskScaledHeight(seats: number): number {
    return DeskBoardArea.height + standingsStripHeight(seats) + ZoomRowBand
}
/**
 * Contract, Supply: the zoom row's height in screen pixels over a desk view's foot, with the gap
 * above it. A desk's focus frames its area above it, so the row never covers what it chose.
 */
export const DeskRowClear = 44
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

/** What a chip frames: the whole board, the map's area and each guild column. */
export function rectOfArea(area: FramedArea): BoardRect {
    switch (area) {
        case 'board': {
            return DeskBoardArea
        }
        case 'map': {
            return MapArea
        }
        default: {
            return columnOf(area)
        }
    }
}

/** The scale the board rests at in a view this size, as the scaling wrapper reckons it. */
export function restScaleOf(viewWidth: number, viewHeight: number): number {
    const across = viewWidth / BoardWidth
    const down = Math.max(1, viewHeight - ChooserInset) / ScaledHeight
    const contain = Math.min(across, down, 1)
    return contain >= CoverBelowScale ? contain : Math.min(Math.max(across, down), 1)
}

/** A desk's rest: the board, the standings' strip and the band contained in the view. */
export function deskRestScaleOf(viewWidth: number, viewHeight: number, seats: number): number {
    return Math.min(viewWidth / DeskBoardArea.width, viewHeight / deskScaledHeight(seats), 1)
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

/** Contract, Focus chooser: the areas holding a lit target, each chip's dot. */
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
    /** On a desk, the board view's size in screen pixels; a phone has none. */
    readonly desk?: () => { readonly width: number; readonly height: number } | undefined
}

/** A desk's chosen area holds a pick when each target stands there; a track stands on the map. */
function viewHolds(chosen: FramedArea | undefined, holds: readonly PlacedArea[] | undefined) {
    if (chosen === 'board') {
        return true
    }
    return (
        chosen !== undefined &&
        holds !== undefined &&
        holds.every((area) => (area === 'tracks' ? 'map' : area) === chosen)
    )
}

/**
 * Board focus (contract: Shared visual state). The chooser or a map pick opening sets it; a pan or
 * zoom by hand clears it. A pick gives back the chip it found when it closes, unless a hand took
 * the view first. It never changes an offer. A phone rests on the map; a desk on the whole board,
 * frames a pick only where the area it stands on leaves a target out, and keeps the zoom row clear.
 */
export class BoardFocus {
    /** The chip the board stands on, until a hand moves it. */
    chosen: FramedArea | undefined = $state('map')
    /** What the open pick has framed, until a hand or a chip takes the view. */
    framed: PickFrame | undefined = $state.raw(undefined)

    /** The lit set last framed, so a hand's pan stays until the lit set changes. */
    private followedKey: string | undefined

    constructor(private readonly setting: BoardFocusSetting) {
        if (setting.desk?.()) {
            this.chosen = 'board'
        }
    }

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

    /** The area the board rests on: the whole board on a desk, the map on a phone held upright. */
    private restsOn(area: FramedArea): boolean {
        if (area === 'board') {
            return true
        }
        return !this.setting.desk?.() && area === 'map' && !this.setting.sideways()
    }

    /**
     * Frames a rect in board units. A desk draws its part of the board, so the rect moves by that
     * part's corner; and the zoom row stands over the view's foot, so the rect reaches the row's
     * height further down at the scale it will be shown, and the area stands whole above the row.
     */
    private frame(rect: BoardRect) {
        const options = this.options()
        const desk = this.setting.desk?.()
        if (!desk) {
            this.setting.view()?.focusRect(rect, options)
            return
        }
        const scale = Math.min(
            (desk.width - 2 * FramePadding.x) / rect.width,
            (desk.height - 2 * FramePadding.y - DeskRowClear) / rect.height,
            options.maxScale
        )
        const framed = {
            x: rect.x - DeskBoardArea.x,
            y: rect.y - DeskBoardArea.y,
            width: rect.width,
            height: rect.height + (scale > 0 ? DeskRowClear / scale : 0)
        }
        this.setting.view()?.focusRect(framed, options)
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
     * size changes with the panel; nothing over a hand's view. A desk at rest keeps the wrapper's
     * own fit, which follows the view's size.
     */
    settle() {
        if (this.framed) {
            this.frame(this.framed.rect)
        } else if (this.chosen && !(this.setting.desk?.() && this.chosen === 'board')) {
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

    /**
     * Reads the open pick: frames a lit set new to it, and gives the view back when it closes. A
     * desk frames it only where the chosen area leaves a target out; the whole board leaves none.
     */
    follow(frame: PickFrame | undefined) {
        if (frame?.key === this.followedKey) {
            return
        }
        this.followedKey = frame?.key
        const inView = frame && this.setting.desk?.() && viewHolds(this.chosen, frame.holds)
        if (frame && !inView) {
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
