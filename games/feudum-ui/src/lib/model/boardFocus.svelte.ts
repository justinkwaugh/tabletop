import type { BoundingBox, Point, RectangleDimensions } from '@tabletop/common'
import { untrack } from 'svelte'
import {
    EpicVoyageTrack,
    GuildIds,
    MilitaryServiceTrack,
    Spaces,
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
    westGuild
} from '$lib/utils/boardGeometry.js'
import type { BoardOffer, BoardTarget } from './boardOffer.js'
import { ChipHeight, chipLayout, spaceChips } from './spaceChips.js'

/** Contract, Phone layout: the focus chooser's chips; a desk has the map alone (Desk layout). */
export type FocusArea = 'map' | 'west' | 'east' | 'tracks'
export type FramedArea = Exclude<FocusArea, 'tracks'>
export type PlacedArea = FocusArea
export type GuildSide = 'west' | 'east'

/** The key is the lit set, so one pick frames once. */
export interface PickFrame {
    readonly key: string
    readonly rect: BoundingBox
    readonly area?: FramedArea
    readonly holds?: readonly PlacedArea[]
}

/** Below this fit the board's targets are too small to tap: a phone rests at a cover fit. */
export const CoverBelowScale = 0.2
export const ChooserInset = 36
/** Contract, Symbol key and Supply: the band keeps the zoom row off the score track. */
export const ZoomRowBand = 128
export const ScaledHeight = BoardHeight + ZoomRowBand

/** Contract, Desk layout: a guild side's button, its width and gap to the map in pixels. */
export const SideButtonWidth = 45
export const SideButtonGap = 4
export const SideGutter = SideButtonWidth + SideButtonGap

export function deskScaledHeight(seats: number): number {
    return MapArea.height + standingsStripHeight(seats) + ZoomRowBand
}

/** Contract, Desk layout: the side column, where the map's height binds. */
export interface DeskColumn {
    readonly perRow: 1 | 2
    readonly width: number
}

export const DeskColumnGap = 8
export const DeskColumnWidth = 256
export const DeskColumnRailGap = 4
export const DeskZoomRow = 36
export const DeskColumnSpacing = 6
export const DeskScoreLineRow = 24
export const DeskScoreLineFrame = 12
export const MinColumnRailScale = 0.85

export function deskColumnFoot(seats: number): number {
    const scoreLine = Math.ceil(seats / 2) * DeskScoreLineRow + DeskScoreLineFrame
    return DeskZoomRow + 2 * DeskColumnSpacing + scoreLine
}

export function columnRailScale(height: number, seats: number, perRow: 1 | 2): number {
    const rows = GuildIds.length / perRow
    const room = height - (rows - 1) * DeskColumnRailGap
    return Math.max(0, Math.min(1, room / (rows * stripRailDrawingHeight(seats))))
}

function besideOf(column: DeskColumn | undefined): number {
    return column ? DeskColumnGap + column.width : 0
}

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

/** Contract, Desk layout: only the room decides, never the view, so the layout never flips. */
export function deskColumnOf(room: RectangleDimensions, seats: number): DeskColumn | undefined {
    const one = columnRailScale(room.height - deskColumnFoot(seats), seats, 1)
    const column: DeskColumn =
        one >= MinColumnRailScale
            ? { perRow: 1, width: DeskColumnWidth }
            : { perRow: 2, width: 2 * StandingsStrip.drawing.width + DeskColumnRailGap }
    const strip = deskRestScaleOf(room.width, room.height, seats)
    const beside = deskRestScaleOf(room.width, room.height, seats, column)
    return beside > strip ? column : undefined
}

/** Rounded up, so the room's height, where it binds, stays what binds the wrapper's fit. */
export function deskColumnViewWidth(
    room: RectangleDimensions,
    seats: number,
    column: DeskColumn
): number {
    const scale = Math.max(0, deskRestScaleOf(room.width, room.height, seats, column))
    return Math.min(
        room.width,
        Math.ceil(MapArea.width * scale + 2 * SideGutter + besideOf(column))
    )
}

export function deskColumnBox(view: RectangleDimensions, column: DeskColumn): BoundingBox {
    return { x: view.width - column.width, y: 0, width: column.width, height: view.height }
}

/** Contract, Supply: the desk view's height at the column's width, before it gives way. */
export function deskViewHeight(viewWidth: number, seats: number): number {
    return (Math.max(0, viewWidth - 2 * SideGutter) * deskScaledHeight(seats)) / MapArea.width
}

export interface DeskRest extends BoundingBox {
    readonly scale: number
    readonly gutter: number
    readonly trail: number
}

/** The content carries a gutter each side, so the wrapper's own contain fit is the rest. */
export function deskMapAtRest(
    view: RectangleDimensions,
    seats: number,
    centred: boolean,
    column?: DeskColumn
): DeskRest {
    const scale = deskRestScaleOf(view.width, view.height, seats, column)
    if (!(scale > 0)) {
        return { x: SideGutter, y: 0, width: 0, height: 0, scale: 0, gutter: 0, trail: 0 }
    }
    const width = MapArea.width * scale
    const beside = besideOf(column)
    const left = centred ? Math.max(0, (view.width - width - 2 * SideGutter - beside) / 2) : 0
    const fitted = column ? MapArea.height : deskScaledHeight(seats)
    const top = centred ? Math.max(0, (view.height - fitted * scale) / 2) : 0
    // The wrapper centres the strip's content itself; the column's fills the view, slack inside.
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

export function guildSideOf(target: BoardTarget): GuildSide | undefined {
    const [kind, id] = target.split(':')
    if (kind !== 'guild') {
        return undefined
    }
    return GuildIds.some((guild) => guild === id && westGuild(guild)) ? 'west' : 'east'
}

export type GuildSideFollowing = GuildSide | 'keep' | undefined

/** Contract, Pick framing: a pick opens a desk's guild side when that side holds every target. */
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
const FramePadding = { x: 12, y: 12 }
const TargetRoom = DiscFrame
const ChipRoom = 6

const SpacePoints = new Map<string, Point>(Object.entries(SpaceCentres))
const StackPoints = new Map<string, Point>(Object.entries(StackCentres))

/** Contract, Pick conventions: a row of chips on a shared space is framed whole. */
function chipCorners(state: HydratedFeudumGameState, offer: BoardOffer): Point[] {
    return Spaces.flatMap(({ id }) =>
        spaceChips(state, offer, id).flatMap(({ chip, at }) => {
            const half = chipLayout(chip).width / 2
            return [
                { x: at.x - half, y: at.y - ChipHeight / 2 },
                { x: at.x + half, y: at.y + ChipHeight / 2 }
            ]
        })
    )
}

function enclosing(first: BoundingBox, second: BoundingBox): BoundingBox {
    if (!(second.width > 0)) {
        return first
    }
    const left = Math.min(first.x, second.x)
    const top = Math.min(first.y, second.y)
    const right = Math.max(first.x + first.width, second.x + second.width)
    const bottom = Math.max(first.y + first.height, second.y + second.height)
    return { x: left, y: top, width: right - left, height: bottom - top }
}

function unionOf(points: readonly Point[], room: number): BoundingBox {
    const left = Math.min(...points.map(({ x }) => x)) - room
    const top = Math.min(...points.map(({ y }) => y)) - room
    const right = Math.max(...points.map(({ x }) => x)) + room
    const bottom = Math.max(...points.map(({ y }) => y)) + room
    return { x: left, y: top, width: right - left, height: bottom - top }
}

/** Contract, Guild standings: a guild column with its rails at the map's inner edge. */
function columnOf(area: 'west' | 'east'): BoundingBox {
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

export function rectOfArea(area: FramedArea): BoundingBox {
    return area === 'map' ? MapArea : columnOf(area)
}

/** As the scaling wrapper reckons its rest. */
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

/** Contract, Focus chooser: the areas holding a lit target, for the chips' and buttons' dots. */
export function litAreasOf(
    state: HydratedFeudumGameState,
    offer: BoardOffer
): ReadonlySet<FocusArea> {
    return new Set(litTargets(offer).map((target) => placeOf(state, target).area))
}

/** Contract, Pick framing: a popup shows only while its anchor is in view, so it is framed too. */
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
        const chips = unionOf(chipCorners(state, offer), ChipRoom)
        return { key, rect: enclosing(unionOf(onMap, TargetRoom), chips), holds }
    }
    for (const area of ['west', 'east'] as const) {
        if (placed.some((place) => place.area === area)) {
            return { key, rect: columnOf(area), area, holds }
        }
    }
    const onTracks = points('tracks')
    return onTracks.length > 0 ? { key, rect: unionOf(onTracks, TargetRoom), holds } : undefined
}

export interface BoardView {
    focusRect(
        rect: BoundingBox,
        options: { maxScale: number; padding: Point; animate: boolean }
    ): void
    fitToContent(options: { animate: boolean }): void
}

export interface BoardFocusSetting {
    readonly view: () => BoardView | undefined
    readonly restScale: () => number
    readonly sideways: () => boolean
    readonly animate: () => boolean
    readonly pickFrame: () => PickFrame | undefined
}

/** Contract, Shared visual state: a phone's board focus; it never changes an offer. */
export class BoardFocus {
    chosen: FramedArea | undefined = $state('map')
    private readonly pickKey = $derived.by(() => this.setting.pickFrame()?.key)
    /** Untracked, so a hand's pan stays until the lit set changes. */
    framed: PickFrame | undefined = $derived.by(() => {
        void this.pickKey
        return untrack(() => this.setting.pickFrame())
    })

    constructor(private readonly setting: BoardFocusSetting) {}

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

    private restsOn(area: FramedArea): boolean {
        return area === 'map' && !this.setting.sideways()
    }

    private frame(rect: BoundingBox) {
        this.setting.view()?.focusRect(rect, this.options())
    }

    private show(area: FramedArea) {
        if (this.restsOn(area)) {
            this.setting.view()?.fitToContent({ animate: this.setting.animate() })
        } else {
            this.frame(rectOfArea(area))
        }
    }

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
    }

    handMoved() {
        this.chosen = undefined
        this.framed = undefined
    }
}
