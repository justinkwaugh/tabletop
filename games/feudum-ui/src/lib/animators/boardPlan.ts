import type { Color, GameAction } from '@tabletop/common'
import {
    AlchemistCartSpaces,
    EpochTrack,
    FarmerBarn,
    GuildTrackSpaces,
    Goods,
    KnightMonsterIcons,
    MarketSpaces,
    RegionTiles,
    Spaces,
    isAnswerAttack,
    isBeginDawn,
    isCommitAttack,
    isMove,
    isPinned,
    isRollProgressDie,
    type Good,
    type GuildId,
    type HydratedFeudumGameState,
    type LandscapeKind,
    type LocationKind,
    type Move,
    type PieceRef,
    type RegionId,
    type SpaceId,
    type TileEpoch,
    type TileId,
    type VesselType
} from '@tabletop/feudum'
import { scoreOnTrack, serviceDiscs, voyageDiscs, type TrackDisc } from '$lib/model/boardView.js'
import {
    goodKinds,
    goodStacks,
    pieceKey,
    piecesOn,
    slottedPieces,
    type MapPiece
} from '$lib/model/mapView.js'
import {
    EpochRays,
    GuildAreaWidth,
    GuildAreas,
    GuildBox,
    GuildSizes,
    MarkerSize,
    PawnSize,
    RoutePaths,
    ServiceFanStep,
    ServiceSpaces,
    StackCentres,
    SupplyCorner,
    VoyageFanStep,
    VoyageSpaces,
    barnTokenAt,
    DieCentre,
    fanOffset,
    guildSlot,
    knightCell,
    knightRowLabel,
    monsterIconMarker,
    plateSlot,
    reeveOffset,
    routePointAt,
    scoreDiscAt,
    spaceGeometry,
    trackPlace,
    type Point
} from '$lib/utils/boardGeometry.js'

/**
 * What each change on the board looks like, as a plan and nothing else: no element, no clock. It reads
 * only the displayed states and the Action as this seat received it, and of the state only what every
 * seat sees: no hand, pouch, writ or sealed charter, so no motion differs by what another seat holds.
 */

/** Without an Action nothing takes longer than this (contract: Fast fallback). */
export const FastSeconds = 0.2

export type PlanRow =
    'pieces' | 'markers' | 'goods' | 'tiles' | 'discs' | 'die' | 'dawn' | 'combat' | 'score'

/** What a transient token draws. It stands for a piece the state has not yet put there. */
export type TokenFace =
    | { readonly kind: 'good'; readonly good: Good; readonly size: number }
    | {
          readonly kind: 'marker'
          readonly owner: { readonly playerId: string } | { readonly colour: Color }
          readonly size: number
      }
    | { readonly kind: 'vessel'; readonly vessel: VesselType }
    | { readonly kind: 'ferry' }
    | {
          readonly kind: 'location'
          readonly location: LocationKind
          readonly guild?: GuildId
          readonly start: boolean
      }
    | { readonly kind: 'seal' }
    | { readonly kind: 'die-face'; readonly region: RegionId }
    | { readonly kind: 'tile'; readonly epoch: TileEpoch; readonly landscape: LandscapeKind }
    | { readonly kind: 'chip'; readonly text: string; readonly rose: boolean }
    | { readonly kind: 'defend'; readonly playerId: string }
    | { readonly kind: 'glow' }

export interface MotionToken {
    readonly id: string
    readonly face: TokenFace
    readonly place: Point
    readonly layer: 'under' | 'over'
    readonly scaleX?: number
}

export type MotionTarget =
    { readonly piece: string; readonly part?: 'rides' } | { readonly token: string }

export interface MotionChange {
    /** Points on the element's own canvas; the first gives way to wherever the element stands. */
    readonly path?: readonly Point[]
    /** A token shows from its motion's start. */
    readonly reveal?: boolean
    readonly opacity?: number
    readonly scaleX?: number
    /** Up to this scale and back. */
    readonly pulse?: number
    /** Whole turns, ending as it began. */
    readonly turns?: number
}

export interface BoardMotion extends MotionChange {
    readonly row: PlanRow
    readonly target: MotionTarget
    readonly at: number
    readonly duration: number
}

export interface BoardPlan {
    readonly tokens: readonly MotionToken[]
    readonly motions: readonly BoardMotion[]
    /** When the flight layer's copies leave: after the board's own rows, before the score slides. */
    readonly flightsAt?: number
}

export interface BoardChange {
    readonly from: HydratedFeudumGameState
    readonly to: HydratedFeudumGameState
}

const PieceSpeed = 700
const PieceLeast = 0.35
const PieceMost = 0.8
const StepGap = 0.06
const GodspeedPause = 0.3
const RouteSamples = 12
const SlideSeconds = 0.4
export const FlipSeconds = 0.18
export const GoodFlight = 0.4
export const GoodGap = 0.05
const ArcRise = 40
const ArcSamples = 8
const FadeSeconds = 0.2
const TumbleSeconds = 0.7
const FaceHold = 0.3
const PulseScale = 1.15
const PulseSeconds = 0.35
const ChipRise = 34
const ChipSeconds = 0.5
const ChipHold = 0.5
const DawnRowSeconds = 0.5
const DawnRowGap = 0.1
const EpochSeconds = 0.6
const ScoreLeast = 0.35
const ScoreMost = 0.9
const ScorePerSpace = 0.03
const ScoreSamples = 24
const SealDrop = MarkerSize
export const GuildScale = GuildAreaWidth / GuildBox.width

class PlanBuilder implements BoardPlan {
    readonly tokens: MotionToken[] = []
    readonly motions: BoardMotion[] = []
    flightsAt = 0
    pilferToken: MotionTarget | undefined

    token(face: TokenFace, place: Point, layer: 'under' | 'over' = 'over', scaleX?: number) {
        const id = `token-${this.tokens.length}`
        this.tokens.push({ id, face, place, layer, ...(scaleX === undefined ? {} : { scaleX }) })
        return { token: id }
    }

    /** Adds a motion and gives the time it ends. */
    move(
        row: PlanRow,
        target: MotionTarget,
        at: number,
        duration: number,
        change: MotionChange
    ): number {
        this.motions.push({ row, target, at, duration, ...change })
        return at + duration
    }
}

function distance(a: Point, b: Point): number {
    return Math.hypot(b.x - a.x, b.y - a.y)
}

function pathLength(path: readonly Point[]): number {
    return path.slice(1).reduce((total, point, index) => total + distance(path[index], point), 0)
}

function clamp(value: number, least: number, most: number): number {
    return Math.min(most, Math.max(least, value))
}

function shifted(path: readonly Point[], x: number, y: number): readonly Point[] {
    return path.map((point) => ({ x: point.x + x, y: point.y + y }))
}

function arc(from: Point, to: Point): readonly Point[] {
    return Array.from({ length: ArcSamples + 1 }, (_, index) => {
        const t = index / ArcSamples
        return {
            x: from.x + (to.x - from.x) * t,
            y: from.y + (to.y - from.y) * t - ArcRise * Math.sin(Math.PI * t)
        }
    })
}

export function guildPoint(guild: GuildId, { x, y }: Point): Point {
    const area = GuildAreas[guild]
    return { x: area.x + x * GuildScale, y: area.y + y * GuildScale }
}

// Pawns and monsters

export interface PlacedPiece {
    readonly piece: MapPiece
    readonly spaceId: SpaceId
    readonly point: Point
}

/** Where each piece a space shows stands (R-4.1), in the map's own slots. */
export function placedPieces(state: HydratedFeudumGameState): ReadonlyMap<string, PlacedPiece> {
    const placed = new Map<string, PlacedPiece>()
    for (const { id } of Spaces) {
        const { pieceSlots } = spaceGeometry(id)
        slottedPieces(piecesOn(state, id)).shown.forEach((piece, slot) => {
            placed.set(pieceKey(piece), { piece, spaceId: id, point: pieceSlots[slot] })
        })
    }
    return placed
}

export function keyOfRef(ref: PieceRef): string {
    return ref.kind === 'pawn' ? `pawn:${ref.playerId}:${ref.n}` : `monster:${ref.monsterId}`
}

/** R-1.2.3 A route's line, walked from the space it left. */
function routeWalk(routeId: string, from: SpaceId): readonly Point[] {
    const route = [...RoutePaths].find(([id]) => id === routeId)?.[1]
    if (!route) {
        return []
    }
    const points = Array.from({ length: RouteSamples + 1 }, (_, index) =>
        routePointAt(route, index / RouteSamples)
    )
    const { centre } = spaceGeometry(from)
    return distance(route.from, centre) <= distance(route.to, centre) ? points : points.reverse()
}

interface MoveWay {
    readonly piece: PieceRef
    readonly to: SpaceId
    readonly ferry: boolean
    readonly boards: boolean
    readonly routeId: string
    readonly from: SpaceId
    readonly vessel?: VesselType
    readonly left?: VesselType
    readonly pause: number
}

function waysOf(action: Move): readonly MoveWay[] {
    const { metadata, steps, godspeed, playerId } = action
    if (!metadata) {
        return []
    }
    const ways: MoveWay[] = []
    steps.forEach((step, index) => {
        const record = metadata.steps.at(index)
        if (record) {
            ways.push({
                piece: step.piece,
                to: step.to,
                ferry: step.ferry === true,
                boards: step.vessel === 'board',
                routeId: record.routeId,
                from: record.from,
                vessel: record.vessel,
                left: record.left,
                pause: 0
            })
        }
    })
    if (godspeed && metadata.godspeed && playerId) {
        const record = metadata.godspeed
        ways.push({
            piece: { kind: 'pawn', playerId, n: godspeed.pawn },
            to: godspeed.to,
            ferry: godspeed.ferry === true,
            boards: godspeed.vessel === 'board',
            routeId: record.routeId,
            from: record.from,
            vessel: record.vessel,
            left: record.left,
            pause: GodspeedPause
        })
    }
    return ways
}

/**
 * R-3.7.1 Each named piece steps along its route, one after another in the order pressed. R-4.2.2 The
 * vessel rides under its pawn: the pawn's own while it stays on, else a token taken up from the space.
 * R-4.2.3 The ferry crosses with it. R-3.7.3 Godspeed's step comes after a pause.
 */
function playWays(
    plan: PlanBuilder,
    action: Move,
    { from, to }: BoardChange,
    start: number
): { readonly ends: number; readonly named: ReadonlySet<string> } {
    const before = placedPieces(from)
    const after = placedPieces(to)
    const ways = waysOf(action)
    const named = new Set<string>()
    const riders = new Map<string, MotionTarget>()
    const ownVessel = new Map<string, boolean>()
    let cursor = start
    ways.forEach((way, index) => {
        const key = keyOfRef(way.piece)
        const first = !named.has(key)
        named.add(key)
        const last = !ways.slice(index + 1).some(({ piece }) => keyOfRef(piece) === key)
        const beginning = first ? before.get(key)?.point : undefined
        const ending = last ? after.get(key)?.point : undefined
        const walk = routeWalk(way.routeId, way.from)
        const path = [
            beginning ?? spaceGeometry(way.from).centre,
            ...walk,
            ending ?? spaceGeometry(way.to).centre
        ]
        const duration = clamp(pathLength(path) / PieceSpeed, PieceLeast, PieceMost)
        const at = cursor + way.pause
        if (first) {
            const placed = before.get(key)?.piece
            ownVessel.set(key, placed?.kind === 'pawn' && placed.vessel !== undefined)
        }
        const rideOffset = PawnSize / 2
        if (way.left) {
            const slot = spaceGeometry(way.from).vessels[way.left]
            const rider = riders.get(key)
            if (rider) {
                plan.move('pieces', rider, at, FadeSeconds, { path: [slot, slot] })
                riders.delete(key)
            } else {
                plan.move('pieces', { piece: key, part: 'rides' }, at, 0, { opacity: 0 })
                plan.move(
                    'pieces',
                    plan.token({ kind: 'vessel', vessel: way.left }, slot, 'under'),
                    at,
                    0,
                    {
                        reveal: true
                    }
                )
            }
            ownVessel.set(key, false)
        }
        if (way.vessel && !ownVessel.get(key) && !riders.has(key)) {
            const place = { x: path[0].x, y: path[0].y + rideOffset }
            const rider = plan.token({ kind: 'vessel', vessel: way.vessel }, place, 'under')
            riders.set(key, rider)
            plan.move('pieces', rider, at, 0, { reveal: true })
            if (way.boards && from.spaces[way.from].vessels[way.vessel] === 1) {
                plan.move('pieces', { piece: `vessel:${way.from}:${way.vessel}` }, at, 0, {
                    opacity: 0
                })
            }
        }
        const rider = riders.get(key)
        if (rider) {
            plan.move('pieces', rider, at, duration, { path: shifted(path, 0, rideOffset) })
        }
        if (way.ferry) {
            const ferry = plan.token({ kind: 'ferry' }, path[0], 'under')
            plan.move('pieces', ferry, at, duration, { path, reveal: true })
            plan.move('pieces', ferry, at + duration, FadeSeconds, { opacity: 0 })
        }
        cursor = plan.move('pieces', { piece: key }, at, duration, { path }) + StepGap
    })
    return { ends: cursor, named }
}

/** R-3.7.4 The good hops from its space onto the piece that took it; the seat's leg is off the board. */
function playPilfer(
    plan: PlanBuilder,
    action: Move,
    { from, to }: BoardChange,
    at: number
): number {
    const { pilfer, metadata } = action
    const good = Goods.find((one) => one === pilfer?.resource)
    if (!pilfer || !metadata?.pilfer || !good) {
        return at
    }
    const { spaceId } = metadata.pilfer
    const landing = placedPieces(to).get(keyOfRef(pilfer.piece))?.point
    const source = spaceGoodPlace(from, spaceId, good)
    const flight = arc(
        source?.point ?? spaceGeometry(spaceId).centre,
        landing ?? spaceGeometry(spaceId).centre
    )
    if (source?.key) {
        plan.move('goods', { piece: source.key }, at, 0, { opacity: 0 })
    }
    const token = plan.token({ kind: 'good', good, size: 26 }, flight[0])
    plan.pilferToken = token
    return plan.move('goods', token, at, GoodFlight, { path: flight, reveal: true })
}

/**
 * A piece not named moves only as far as the state put it. Among a Move's pieces one left on its space
 * settles into its slot; R-4.2.4 a pinned pawn keeps still whatever the slots do.
 */
function slidePieces(
    plan: PlanBuilder,
    { from, to }: BoardChange,
    at: number,
    moved?: ReadonlySet<string>
): number {
    let ends = at
    const after = placedPieces(to)
    for (const [key, { piece, point, spaceId }] of placedPieces(from)) {
        const placed = after.get(key)
        if (!placed || moved?.has(key) || sameness(placed.point, point)) {
            continue
        }
        if (moved) {
            const pinned = piece.kind === 'pawn' && isPinned(from, piece.playerId, piece.n)
            if (pinned || placed.spaceId !== spaceId) {
                continue
            }
        }
        ends = Math.max(
            ends,
            plan.move('pieces', { piece: key }, at, SlideSeconds, { path: [point, placed.point] })
        )
    }
    return ends
}

function sameness(a: Point, b: Point): boolean {
    return a.x === b.x && a.y === b.y
}

// Markers

interface HeldRole {
    readonly role: 'ruler' | 'subject' | 'serf'
    readonly playerId: string
}

function rolesOn(state: HydratedFeudumGameState, spaceId: SpaceId): readonly HeldRole[] {
    const { ruler, serf } = state.spaces[spaceId]
    return [
        ...(ruler ? [{ role: 'ruler' as const, playerId: ruler.playerId }] : []),
        ...(ruler?.subject ? [{ role: 'subject' as const, playerId: ruler.playerId }] : []),
        ...(serf ? [{ role: 'serf' as const, playerId: serf.playerId }] : [])
    ]
}

/** R-4.1.2 A marker that changes role on its space slides there: ruler and serf swap places. */
function slideRoles(plan: PlanBuilder, { from, to }: BoardChange, at: number): number {
    let ends = at
    for (const { id } of Spaces) {
        const before = rolesOn(from, id)
        const after = rolesOn(to, id)
        const geometry = spaceGeometry(id)
        for (const { role, playerId } of before) {
            const kept = after.some((held) => held.role === role && held.playerId === playerId)
            const taken = after.find(
                (held) =>
                    held.playerId === playerId &&
                    !before.some((was) => was.role === held.role && was.playerId === playerId)
            )
            if (!kept && taken) {
                ends = plan.move('markers', { piece: `marker:${id}:${role}` }, at, SlideSeconds, {
                    path: [geometry[role], geometry[taken.role]]
                })
            }
        }
    }
    return ends
}

/** R-4.5.2 A rank's marker slides between its guild's rank spaces, its reeve with it. */
function slideRanks(plan: PlanBuilder, { from, to }: BoardChange, at: number): number {
    let ends = at
    for (const space of GuildTrackSpaces) {
        const holder = from.guilds.tracks[space.guild][space.rank]
        if (!holder || to.guilds.tracks[space.guild][space.rank]?.playerId === holder.playerId) {
            continue
        }
        const next = GuildTrackSpaces.find(
            (other) =>
                other.guild === space.guild &&
                to.guilds.tracks[other.guild][other.rank]?.playerId === holder.playerId
        )
        if (!next) {
            continue
        }
        const start = guildSlot(space.id)
        const end = guildSlot(next.id)
        ends = plan.move('markers', { piece: `rank:${space.id}` }, at, SlideSeconds, {
            path: [start, end]
        })
        if (holder.reeve) {
            const offset = reeveOffset(space.guild)
            plan.move('markers', { piece: `reeve:${space.id}` }, at, SlideSeconds, {
                path: shifted([start, end], offset.x, offset.y)
            })
        }
    }
    return ends
}

/** R-4.8 Markers fill a Knight row inside the guild area, one a beat after another. */
function fillKnightRows(plan: PlanBuilder, { from, to }: BoardChange, at: number): number {
    let ends = at
    for (const row of to.guilds.knight.rows) {
        const was =
            from.guilds.knight.rows.find(({ colour }) => colour === row.colour)?.markers ?? 0
        const label = guildPoint('knight', knightRowLabel(row.colour))
        for (let column = was + 1; column <= row.markers; column += 1) {
            const token = plan.token(
                {
                    kind: 'marker',
                    owner: row.playerId ? { playerId: row.playerId } : { colour: row.colour },
                    size: GuildSizes.marker * GuildScale
                },
                label
            )
            ends = plan.move('markers', token, at + (column - was - 1) * GoodGap, SlideSeconds, {
                path: [label, guildPoint('knight', knightCell(row.colour, column))],
                reveal: true
            })
        }
    }
    return ends
}

/** R-4.2.4 Taking control: the row's top marker moves onto the monster's icon. */
function markMonsterIcons(plan: PlanBuilder, { from, to }: BoardChange, at: number): number {
    let ends = at
    for (const icon of KnightMonsterIcons) {
        const controller = to.guilds.knight.monsterIcons[icon.monster]
        const row = from.guilds.knight.rows.find(({ playerId }) => playerId === controller)
        if (!controller || from.guilds.knight.monsterIcons[icon.monster] === controller || !row) {
            continue
        }
        const start = knightCell(row.colour, row.markers)
        ends = plan.move(
            'markers',
            { piece: `knight:${row.colour}:${row.markers}` },
            at,
            SlideSeconds,
            {
                path: [start, monsterIconMarker(icon.id)]
            }
        )
    }
    return ends
}

/** R-3.14.2 A crowned seal slides in under the marker it guards. */
function slideSeals(plan: PlanBuilder, { from, to }: BoardChange, at: number): number {
    let ends = at
    const slide = (place: Point) => {
        const under = { x: place.x, y: place.y + MarkerSize / 2 }
        const start = { x: under.x, y: under.y + SealDrop }
        const token = plan.token({ kind: 'seal' }, start, 'under')
        ends = plan.move('markers', token, at, SlideSeconds, { path: [start, under], reveal: true })
    }
    for (const { id } of Spaces) {
        const before = from.spaces[id]
        const after = to.spaces[id]
        if (after.serf?.immune && !before.serf?.immune) {
            slide(spaceGeometry(id).serf)
        }
        if (after.ruler?.subjectImmune && !before.ruler?.subjectImmune) {
            slide(spaceGeometry(id).subject)
        }
    }
    return ends
}

function trackDiscPlace(table: ReadonlyMap<string, Point>, disc: TrackDisc, step: number): Point {
    const at = trackPlace(table, disc.spaceId)
    return { x: at.x + fanOffset(disc.index, disc.count, step), y: at.y }
}

/** R-3.7.5, R-4.9-H2 A disc that stays on its track slides to where its track now puts it. */
function slideTrackDiscs(plan: PlanBuilder, { from, to }: BoardChange, at: number): number {
    let ends = at
    const tracks = [
        { of: voyageDiscs, table: VoyageSpaces, step: VoyageFanStep },
        { of: serviceDiscs, table: ServiceSpaces, step: ServiceFanStep }
    ]
    for (const { of, table, step } of tracks) {
        const after = of(to)
        for (const disc of of(from)) {
            const next = after.find(({ key }) => key === disc.key)
            if (!next) {
                continue
            }
            const start = trackDiscPlace(table, disc, step)
            const end = trackDiscPlace(table, next, step)
            if (!sameness(start, end)) {
                ends = plan.move('markers', { piece: disc.key }, at, SlideSeconds, {
                    path: [start, end]
                })
            }
        }
    }
    return ends
}

// Discs

/** R-4.3.4 A location disc that changes flips: edge-on, then its new face. */
function flipLocations(plan: PlanBuilder, { from, to }: BoardChange, at: number): number {
    let ends = at
    for (const { id, startingSpace } of Spaces) {
        const was = from.spaces[id].location
        const now = to.spaces[id].location
        if (was.kind === now.kind && was.feudumGuild === now.feudumGuild) {
            continue
        }
        plan.move('discs', { piece: `disc:${id}` }, at, FlipSeconds, { scaleX: 0 })
        const face = plan.token(
            {
                kind: 'location',
                location: now.kind,
                ...(now.feudumGuild ? { guild: now.feudumGuild } : {}),
                start: startingSpace === true
            },
            spaceGeometry(id).centre,
            'under',
            0
        )
        ends = plan.move('discs', face, at + FlipSeconds, FlipSeconds, { scaleX: 1, reveal: true })
    }
    return ends
}

// Goods

export interface GoodPlace {
    readonly point: Point
    /** The token that may leave its stack: a counted stack keeps its one token until the state changes. */
    readonly key?: string
}

function spaceGoodPlace(
    state: HydratedFeudumGameState,
    spaceId: SpaceId,
    good: Good
): GoodPlace | undefined {
    const kinds = goodKinds(state.spaces[spaceId].goods)
    const slot = kinds.findIndex((kind) => kind.good === good)
    if (slot < 0) {
        return undefined
    }
    return {
        point: plateSlot(spaceGeometry(spaceId).plate, slot),
        ...(kinds[slot].count === 1 ? { key: `good:${spaceId}:${good}` } : {})
    }
}

function barnGoodPlace(state: HydratedFeudumGameState, good: Good): GoodPlace {
    const stack = goodStacks(state.guilds.farmer.barn).find((one) => one.good === good)
    const top = Math.max(0, (stack?.tokens ?? 1) - 1)
    return {
        point: guildPoint('farmer', barnTokenAt(good, top)),
        ...(stack && !stack.count ? { key: `good:${FarmerBarn.id}:${good}:${top}` } : {})
    }
}

/** A place on the board that holds goods, how many of `good`, and where one stands. */
interface GoodHolder {
    readonly count: (state: HydratedFeudumGameState, good: Good) => number
    readonly place: (state: HydratedFeudumGameState, good: Good) => GoodPlace | undefined
}

const GoodHolders: readonly GoodHolder[] = [
    ...Spaces.map(({ id }): GoodHolder => ({
        count: (state, good) => state.spaces[id].goods[good],
        place: (state, good) => {
            const shown = spaceGoodPlace(state, id, good)
            return shown ?? { point: plateSlot(spaceGeometry(id).plate, 0) }
        }
    })),
    {
        count: (state, good) => state.guilds.farmer.barn[good],
        place: barnGoodPlace
    },
    ...MarketSpaces.map((space): GoodHolder => ({
        count: (state, good) =>
            space.good === good && state.guilds.merchant.market[space.id] ? 1 : 0,
        place: () => ({
            point: guildPoint('merchant', guildSlot(space.id)),
            key: `good:${space.id}`
        })
    })),
    ...AlchemistCartSpaces.map((space): GoodHolder => ({
        count: (state, good) =>
            space.good === good && state.guilds.alchemist.carts[space.id] ? 1 : 0,
        place: () => ({
            point: guildPoint('alchemist', guildSlot(space.id)),
            key: `good:${space.id}`
        })
    })),
    {
        count: (state, good) => state.supply.haversack[good],
        // Contract, Supply: the haversack is drawn in the Supply card; its goods cross at the corner.
        place: () => ({ point: SupplyCorner })
    }
]

/** One good at a place on the board, on its way to or from somewhere. */
export interface GoodCrossing {
    readonly good: Good
    readonly place: GoodPlace
}

interface GoodCrossings {
    /** A good that left one place on the board and reached another. */
    readonly pairs: readonly {
        readonly good: Good
        readonly from: GoodPlace
        readonly to: GoodPlace
    }[]
    /** What has no such pair: it crossed to or from a seat, so it is the flight layer's. */
    readonly leaving: readonly GoodCrossing[]
    readonly arriving: readonly GoodCrossing[]
}

function goodCrossings(
    { from, to }: BoardChange,
    pilfered?: { readonly good: Good; readonly holder: GoodHolder }
): GoodCrossings {
    const pairs: { good: Good; from: GoodPlace; to: GoodPlace }[] = []
    const left: GoodCrossing[] = []
    const reached: GoodCrossing[] = []
    for (const good of Goods) {
        const leaving: GoodHolder[] = []
        const arriving: GoodHolder[] = []
        for (const holder of GoodHolders) {
            let change = holder.count(to, good) - holder.count(from, good)
            if (pilfered?.good === good && pilfered.holder === holder) {
                change += 1
            }
            for (let times = change; times < 0; times += 1) {
                leaving.push(holder)
            }
            for (let times = change; times > 0; times -= 1) {
                arriving.push(holder)
            }
        }
        const paired = Math.min(leaving.length, arriving.length)
        for (let pair = 0; pair < paired; pair += 1) {
            const source = leaving[pair].place(from, good)
            const landing = arriving[pair].place(to, good)
            if (source && landing) {
                pairs.push({ good, from: source, to: landing })
            }
        }
        for (const holder of leaving.slice(paired)) {
            const place = holder.place(from, good)
            if (place) {
                left.push({ good, place })
            }
        }
        for (const holder of arriving.slice(paired)) {
            const place = holder.place(to, good)
            if (place) {
                reached.push({ good, place })
            }
        }
    }
    return { pairs, leaving: left, arriving: reached }
}

/** R-3.7.4 What the board leaves to the flight layer: the goods with no partner on the board. */
export function goodsOffTheBoard(
    change: BoardChange,
    action?: GameAction
): Pick<GoodCrossings, 'leaving' | 'arriving'> {
    const pilfered = action && isMove(action) ? pilferedHolder(action) : undefined
    const { leaving, arriving } = goodCrossings(change, pilfered)
    return { leaving, arriving }
}

/**
 * R-1.1 Goods that left one place on the board and reached another fly a short arc, one after another a
 * few frames apart. A good with no such pair crossed to or from a seat, which is the flight layer's.
 */
function flyGoods(
    plan: PlanBuilder,
    change: BoardChange,
    at: number,
    pilfered?: { readonly good: Good; readonly holder: GoodHolder }
): number {
    let launch = at
    let ends = at
    for (const { good, from: source, to: landing } of goodCrossings(change, pilfered).pairs) {
        if (source.key) {
            plan.move('goods', { piece: source.key }, launch, 0, { opacity: 0 })
        }
        const token = plan.token({ kind: 'good', good, size: 24 }, source.point)
        ends = plan.move('goods', token, launch, GoodFlight, {
            path: arc(source.point, landing.point),
            reveal: true
        })
        launch += GoodGap
    }
    return ends
}

// Score

function laneOf(state: HydratedFeudumGameState, playerId: string): number {
    return state.players.findIndex((player) => player.playerId === playerId)
}

/** R-1.2.5 The disc walks the ring, score by score, however far it goes. */
function ringWalk(lane: number, from: number, to: number): readonly Point[] {
    const samples = Math.max(1, Math.min(Math.abs(to - from), ScoreSamples))
    return Array.from({ length: samples + 1 }, (_, index) => {
        const score = Math.round(from + ((to - from) * index) / samples)
        return scoreDiscAt(scoreOnTrack(score).space, lane)
    })
}

function ringSeconds(from: number, to: number): number {
    return clamp(Math.abs(to - from) * ScorePerSpace, ScoreLeast, ScoreMost)
}

function slideScores(plan: PlanBuilder, { from, to }: BoardChange, at: number): number {
    let ends = at
    for (const player of from.players) {
        const score = to.getPlayerState(player.playerId).score
        if (score !== player.score) {
            ends = Math.max(
                ends,
                plan.move(
                    'score',
                    { piece: `score:${player.playerId}` },
                    at,
                    ringSeconds(player.score, score),
                    { path: ringWalk(laneOf(from, player.playerId), player.score, score) }
                )
            )
        }
    }
    return ends
}

// Dawn

function epochPlace(state: HydratedFeudumGameState): Point | undefined {
    const ray = EpochTrack.find(({ epoch }) => epoch === state.epoch)
    return ray ? trackPlace(EpochRays, ray.id) : undefined
}

/** R-4.12 The epoch marker goes on to the next ray, and that ray glows. */
function slideEpoch(plan: PlanBuilder, { from, to }: BoardChange, at: number): number {
    const start = epochPlace(from)
    const end = epochPlace(to)
    if (!start || !end || sameness(start, end)) {
        return at
    }
    const ends = plan.move('dawn', { piece: 'epoch-marker' }, at, EpochSeconds, {
        path: [start, end]
    })
    const glow = plan.token({ kind: 'glow' }, end)
    plan.move('dawn', glow, at + EpochSeconds / 2, EpochSeconds / 2, {
        reveal: true,
        pulse: PulseScale
    })
    plan.move('dawn', glow, ends, FadeSeconds, { opacity: 0 })
    return ends
}

/**
 * R-4.12.1 Each seat's disc slides as its row of the sheet appears; R-4.9.2 a disloyal seat's slides
 * back from what it gained, with a rose chip.
 */
function playDawn(
    plan: PlanBuilder,
    sheet: readonly { playerId: string; disloyaltyVp: number; total: number }[],
    from: HydratedFeudumGameState,
    at: number
): number {
    let cursor = at
    for (const { playerId, disloyaltyVp, total } of sheet) {
        const score = from.getPlayerState(playerId).score
        const lane = laneOf(from, playerId)
        const gained = score + total - disloyaltyVp
        const target = { piece: `score:${playerId}` }
        cursor = plan.move('dawn', target, cursor, DawnRowSeconds, {
            path: ringWalk(lane, score, gained)
        })
        if (disloyaltyVp < 0) {
            const back = ringWalk(lane, gained, score + total)
            const place = back[0]
            const chip = plan.token({ kind: 'chip', text: `${disloyaltyVp}`, rose: true }, place)
            plan.move('dawn', chip, cursor, DawnRowSeconds, {
                path: shifted([place, place], 0, -ChipRise),
                reveal: true
            })
            cursor = plan.move('dawn', target, cursor, DawnRowSeconds, { path: back })
            plan.move('dawn', chip, cursor, FadeSeconds, { opacity: 0 })
        }
        cursor += DawnRowGap
    }
    return cursor
}

// The die

/**
 * R-4.11.1 The die tumbles and settles on a region's face; a reroll tumbles again. The stack it named
 * pulses, and R-4.11-H2 a removed tile fades out of it.
 */
function playDie(
    plan: PlanBuilder,
    faces: readonly RegionId[],
    removed:
        | { readonly region: RegionId; readonly tileId: TileId; readonly landscape: LandscapeKind }
        | undefined,
    at: number
): number {
    let cursor = at
    let showing: MotionTarget | undefined
    for (const region of faces) {
        cursor = plan.move('die', { piece: 'progress-die' }, cursor, TumbleSeconds, { turns: 1 })
        if (showing) {
            plan.move('die', showing, cursor - TumbleSeconds, FadeSeconds, { opacity: 0 })
        }
        showing = plan.token({ kind: 'die-face', region }, DieCentre)
        plan.move('die', showing, cursor, 0, { reveal: true })
        cursor += FaceHold
    }
    const named = faces.at(-1)
    if (named) {
        cursor = plan.move('die', { piece: `stack:${named}` }, cursor, PulseSeconds, {
            pulse: PulseScale
        })
    }
    if (removed) {
        const tile = plan.token(
            {
                kind: 'tile',
                epoch: RegionTiles.find(({ id }) => id === removed.tileId)?.epoch ?? 1,
                landscape: removed.landscape
            },
            StackCentres[removed.region]
        )
        plan.move('tiles', tile, cursor, 0, { reveal: true })
        cursor = plan.move('tiles', tile, cursor, FadeSeconds * 2, { opacity: 0 })
    }
    return cursor
}

// Combat

interface CombatFigures {
    readonly spaceId: SpaceId
    readonly attackTotal: number
    readonly defenceTotal: number
    readonly attackerWins: boolean
}

/** R-4.8.2 The tally chips rise over the space, then the result, and they go. */
function playCombat(plan: PlanBuilder, combat: CombatFigures, at: number): number {
    const { x, y } = spaceGeometry(combat.spaceId).centre
    const chips = [
        { text: `${combat.attackTotal}`, rose: false, x: x - 26, y, delay: 0 },
        { text: `${combat.defenceTotal}`, rose: false, x: x + 26, y, delay: ChipSeconds / 2 },
        {
            text: combat.attackerWins ? 'Conquered' : 'Held',
            rose: !combat.attackerWins,
            x,
            y: y - ChipRise,
            delay: ChipSeconds
        }
    ].map(({ text, rose, x: chipX, y: chipY, delay }) => {
        const place = { x: chipX, y: chipY }
        const chip = plan.token({ kind: 'chip', text, rose }, place)
        plan.move('combat', chip, at + delay, ChipSeconds, {
            path: [place, { x: chipX, y: chipY - ChipRise }],
            reveal: true
        })
        return chip
    })
    const held = at + ChipSeconds * 2 + ChipHold
    chips.forEach((chip) => plan.move('combat', chip, held, FadeSeconds, { opacity: 0 }))
    return held + FadeSeconds
}

/** R-3.14.1 The Defend the seat just turned up, beside it on the space under attack. */
function flipDefend(plan: PlanBuilder, spaceId: SpaceId, defenderId: string, at: number): number {
    const { x, y } = spaceGeometry(spaceId).centre
    const card = plan.token({ kind: 'defend', playerId: defenderId }, { x: x + 44, y }, 'over', 0)
    return plan.move('combat', card, at, FlipSeconds * 2, { reveal: true, scaleX: 1 })
}

function playCombatOf(
    plan: PlanBuilder,
    action: GameAction,
    from: HydratedFeudumGameState,
    at: number
): number {
    let cursor = at
    const record = isCommitAttack(action)
        ? action.metadata
        : isAnswerAttack(action)
          ? action.metadata?.combat
          : undefined
    if (isAnswerAttack(action) && action.flipDefend && from.flow.combat) {
        cursor = flipDefend(plan, from.flow.combat.spaceId, from.flow.combat.defenderId, cursor)
    }
    if (record) {
        cursor = playCombat(
            plan,
            {
                spaceId: record.spaceId,
                attackTotal: record.attack.total,
                defenceTotal: record.defence.total,
                attackerWins: record.attackerWins
            },
            cursor
        )
    }
    return cursor
}

// Plans

/** What is the same between states shown to any change: markers, discs and goods. */
function playStateRows(
    plan: PlanBuilder,
    change: BoardChange,
    at: number,
    pilfered?: { readonly good: Good; readonly holder: GoodHolder }
): number {
    const primary = Math.max(
        slideRoles(plan, change, at),
        slideRanks(plan, change, at),
        slideTrackDiscs(plan, change, at),
        flipLocations(plan, change, at),
        slideSeals(plan, change, at),
        fillKnightRows(plan, change, at),
        markMonsterIcons(plan, change, at)
    )
    return flyGoods(plan, change, primary, pilfered)
}

function pilferedHolder(action: Move): { good: Good; holder: GoodHolder } | undefined {
    const good = Goods.find((one) => one === action.pilfer?.resource)
    const spaceId = action.metadata?.pilfer?.spaceId
    const index = Spaces.findIndex(({ id }) => id === spaceId)
    const holder = GoodHolders.at(index)
    return good && index >= 0 && holder && action.pilfer?.from === 'space'
        ? { good, holder }
        : undefined
}

/** The cinematic: what an Action shows, each row in turn at an explicit time. */
export function planBoardMotion({
    from,
    to,
    action,
    flightRoom = 0
}: BoardChange & { readonly action: GameAction; readonly flightRoom?: number }): BoardPlan {
    const plan = new PlanBuilder()
    const change = { from, to }
    let cursor = 0
    let pilfered: { good: Good; holder: GoodHolder } | undefined
    if (isMove(action)) {
        const { ends, named } = playWays(plan, action, change, cursor)
        cursor = slidePieces(plan, change, ends, named)
        cursor = playPilfer(plan, action, change, cursor)
        pilfered = pilferedHolder(action)
    } else {
        cursor = slidePieces(plan, change, cursor)
    }
    if (isRollProgressDie(action) && action.metadata) {
        cursor = playDie(plan, action.metadata.faces, action.metadata.removed, cursor)
    }
    cursor = playCombatOf(plan, action, from, cursor)
    cursor = playStateRows(plan, change, cursor, pilfered)
    if (flightRoom > 0 && plan.pilferToken) {
        // R-3.7.4 The good's last leg, from the piece to the seat, is the flight layer's from here.
        plan.move('goods', plan.pilferToken, cursor, 0, { opacity: 0 })
    }
    plan.flightsAt = cursor
    cursor += flightRoom
    cursor = slideEpoch(plan, change, cursor)
    if (isBeginDawn(action) && action.metadata) {
        playDawn(plan, action.metadata.sheet, from, cursor)
    } else {
        slideScores(plan, change, cursor)
    }
    return plan
}

/** Fast fallback: every piece straight to its new place at once, flips and fades cut to the bound. */
export function planDirect(change: BoardChange): BoardPlan {
    const plan = new PlanBuilder()
    slidePieces(plan, change, 0)
    playStateRows(plan, change, 0)
    slideEpoch(plan, change, 0)
    slideScores(plan, change, 0)
    return {
        tokens: plan.tokens,
        motions: plan.motions.flatMap((motion) => {
            const { path, pulse, turns, ...kept } = motion
            if ((pulse || turns) && !path && kept.opacity === undefined && !kept.reveal) {
                return []
            }
            return [
                {
                    ...kept,
                    at: 0,
                    duration: Math.min(motion.duration, FastSeconds),
                    ...(path ? { path: [path[0], path[path.length - 1]] } : {})
                }
            ]
        })
    }
}
