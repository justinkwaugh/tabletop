import {
    AlchemistCartSpaces,
    GuildById,
    Goods,
    KnightRowIds,
    knightRows,
    MarketSpaces,
    ScrollSpaces,
    VesselTypes,
    type Good,
    type GuildId,
    type HydratedFeudumGameState,
    type KnightRowId,
    type MonsterId,
    type VesselType
} from '@tabletop/feudum'
import {
    GuildSizes,
    barnColumnBox,
    guildSlot,
    knightCell,
    knightRowBox,
    marketBinBox,
    rosaryBead,
    scrollBox,
    vesselForSale,
    vesselForSaleBox,
    type Point
} from '$lib/utils/boardGeometry.js'
import { knightRowPlace, type BenchGhost, type BenchItem, type BenchOffer } from './benchOffer.js'
import { laneOfRow, rowLane, seatRowId } from './knightLanes.js'

/** A place on a guild area, in its local units. */
export interface BenchBox {
    readonly x: number
    readonly y: number
    readonly width: number
    readonly height: number
    readonly round?: true
}

export type GhostPiece =
    | { readonly kind: 'good'; readonly good: Good }
    | { readonly kind: 'vessel'; readonly vessel: VesselType }
    | { readonly kind: 'seal' }
    | { readonly kind: 'monster'; readonly monster: MonsterId }
    /** R-4.6.3, R-4.6.6 A Knight row's marker: the seat's own paint, or its colour's. */
    | { readonly kind: 'marker'; readonly row: KnightRowId }

export interface PlacedGhost {
    readonly key: string
    readonly item: string
    readonly at: string
    readonly piece: GhostPiece
    readonly point?: Point
}

/** One item on its guild area. */
export interface PlacedItem {
    readonly item: BenchItem
    readonly box: BenchBox
    /** It takes its press where it stands. */
    readonly presses: boolean
}

export interface BenchAreaView {
    readonly guild: GuildId
    readonly placed: readonly PlacedItem[]
    /** What the contract words as a button: an invention's recipe, the seat's row with its price. */
    readonly buttons: readonly BenchItem[]
    readonly ghosts: readonly PlacedGhost[]
}

export interface BenchView {
    readonly areas: readonly BenchAreaView[]
    /** Ghosts bound for the seat or the map: no area on the bench holds them. */
    readonly tray: readonly PlacedGhost[]
}

function around({ x, y }: Point, width: number, height = width, round?: true): BenchBox {
    return {
        x: x - width / 2,
        y: y - height / 2,
        width,
        height,
        ...(round ? { round } : {})
    }
}

/** R-4.6.1 A kind of good: its bin's whole row in the market, its column in the barn. */
function goodBox(guild: GuildId, good: Good): BenchBox | undefined {
    if (guild === 'farmer') {
        return barnColumnBox(good)
    }
    if (guild === 'merchant') {
        return marketBinBox(good)
    }
    return undefined
}

function rowBox(
    state: HydratedFeudumGameState,
    row: KnightRowId | undefined
): BenchBox | undefined {
    return row && state.guilds.knight.rows[row] ? knightRowBox(laneOfRow(state, row)) : undefined
}

function rowIdOf(key: string): KnightRowId | undefined {
    return KnightRowIds.find((rowId) => rowId === key)
}

function itemBox(
    id: string,
    guild: GuildId,
    state: HydratedFeudumGameState,
    playerId: string
): BenchBox | undefined {
    const [kind, ...rest] = id.split(':')
    const key = rest.join(':')
    switch (kind) {
        case 'good': {
            const good = Goods.find((name) => name === key)
            return good && goodBox(guild, good)
        }
        case 'vessel': {
            const vessel = VesselTypes.find((name) => name === key)
            return vessel && vesselForSaleBox(vessel)
        }
        case 'row':
            return rowBox(state, key === 'seat' ? seatRowId(state, playerId) : rowIdOf(key))
        case 'scroll':
            return scrollBox(key)
        case 'bead': {
            const index = state.guilds.monk.rosary.findIndex((sealId) => sealId === key)
            return index < 0
                ? undefined
                : around(rosaryBead(index), GuildSizes.bead + 8, undefined, true)
        }
        default:
            return undefined
    }
}

const isInvention = ({ id }: BenchItem) => id.startsWith('invention:')

/** An invention is only a button. The seat's row takes its press where it stands too. */
function isButton(item: BenchItem): boolean {
    return isInvention(item) || item.id === 'row:seat'
}

function pieceOf(
    item: string,
    state: HydratedFeudumGameState,
    playerId: string,
    at: string
): GhostPiece | undefined {
    const [kind, ...rest] = item.split(':')
    const key = rest.join(':')
    if (kind === 'good') {
        const good = Goods.find((name) => name === key)
        return good && { kind: 'good', good }
    }
    if (kind === 'vessel') {
        const vessel = VesselTypes.find((name) => name === key)
        return vessel && { kind: 'vessel', vessel }
    }
    if (kind === 'invention') {
        const vessel = VesselTypes.find((name) => name === key)
        if (vessel) {
            return { kind: 'vessel', vessel }
        }
        const row = knightRows(state).find(({ rowId }) => knightRowPlace(rowId) === at)
        return row && { kind: 'marker', row: row.rowId }
    }
    if (kind === 'row' && key === 'seat') {
        const row = seatRowId(state, playerId)
        return row && { kind: 'marker', row }
    }
    if (kind === 'row' || kind === 'scroll') {
        // R-5-H1 A seal lands unseen.
        return { kind: 'seal' }
    }
    if (kind === 'monster' && (key === 'behemoth' || key === 'sea-serpent')) {
        return { kind: 'monster', monster: key }
    }
    return undefined
}

function guildOfSpace(at: string): GuildId | undefined {
    if (MarketSpaces.some(({ id }) => id === at)) {
        return 'merchant'
    }
    if (AlchemistCartSpaces.some(({ id }) => id === at)) {
        return 'alchemist'
    }
    return ScrollSpaces.some(({ id }) => id === at) ? 'noble' : undefined
}

/** One ghost's markers fill a row's next cells, after any barrel staged ahead of it. */
function markerGhosts(
    ghost: BenchGhost,
    row: KnightRowId,
    state: HydratedFeudumGameState,
    filled: Map<KnightRowId, number>,
    index: number
): readonly PlacedGhost[] {
    const held = state.guilds.knight.rows[row]
    if (!held) {
        return []
    }
    const before = held.markers + (filled.get(row) ?? 0)
    const added = ghost.count ?? 1
    filled.set(row, (filled.get(row) ?? 0) + added)
    return Array.from({ length: added }, (_, cell) => ({
        key: `${index}:${cell}`,
        item: ghost.item,
        at: ghost.at,
        piece: { kind: 'marker', row },
        point: knightCell(rowLane(state, held.owner), before + cell + 1)
    }))
}

interface GhostPlacing {
    readonly guild?: GuildId
    readonly ghosts: readonly PlacedGhost[]
}

/** Where a ghost lands: the offer names the place; this says which area holds it, and the point. */
function placeGhost(
    ghost: BenchGhost,
    index: number,
    state: HydratedFeudumGameState,
    playerId: string,
    onRosary: { count: number },
    filled: Map<KnightRowId, number>,
    vessels: Map<VesselType, number>
): GhostPlacing {
    const { item, at } = ghost
    const piece = pieceOf(item, state, playerId, at)
    if (!piece) {
        return { ghosts: [] }
    }
    const one = (point?: Point): readonly PlacedGhost[] => [
        { key: `${index}`, item, at, piece, ...(point ? { point } : {}) }
    ]
    if (piece.kind === 'marker' && at.startsWith('knight-row:')) {
        return { guild: 'knight', ghosts: markerGhosts(ghost, piece.row, state, filled, index) }
    }
    if (at === 'vessel-space' && piece.kind === 'vessel') {
        const earlier = vessels.get(piece.vessel) ?? 0
        vessels.set(piece.vessel, earlier + 1)
        const { x, y } = vesselForSale(piece.vessel)
        return { guild: 'alchemist', ghosts: one({ x: x + earlier * 8, y: y + earlier * 8 }) }
    }
    if (at === 'rosary') {
        const point = rosaryBead(state.guilds.monk.rosary.length + onRosary.count)
        onRosary.count += 1
        return { guild: 'monk', ghosts: one(point) }
    }
    const guild = guildOfSpace(at)
    return guild ? { guild, ghosts: one(guildSlot(at)) } : { ghosts: one() }
}

/** R-4.6.1 Where the bench's offer stands on its areas. The offer decides; this only places. */
export function benchViewOf(
    bench: BenchOffer,
    state: HydratedFeudumGameState,
    playerId: string
): BenchView {
    const onRosary = { count: 0 }
    const filled = new Map<KnightRowId, number>()
    const vessels = new Map<VesselType, number>()
    const placings = bench.ghosts.map((ghost, index) =>
        placeGhost(ghost, index, state, playerId, onRosary, filled, vessels)
    )
    return {
        areas: bench.areas.map((guild, area) => {
            const items = bench.items.filter((item) => item.area === area)
            return {
                guild,
                placed: items.flatMap((item): PlacedItem[] => {
                    const box = itemBox(item.id, guild, state, playerId)
                    const presses = item.press !== undefined || item.refusal !== undefined
                    return box ? [{ item, box, presses }] : []
                }),
                buttons: items.filter(isButton),
                ghosts: placings.flatMap((placing) =>
                    placing.guild === guild ? placing.ghosts : []
                )
            }
        }),
        tray: placings.flatMap(({ guild, ghosts }) =>
            guild && bench.areas.includes(guild) ? [] : ghosts
        )
    }
}

/** R-4.6 One staged move, as the tray lists it. */
export interface StagedMove {
    readonly item: string
    readonly piece?: GhostPiece
    /** "2 · Merchant → Alchemist", beside the sulfur's piece. */
    readonly text: string
    /** Its accessible name: "2 sulfur from the Merchant to the Alchemist". */
    readonly words: string
    readonly takeBack: () => void
}

export interface StagedMoves {
    readonly lines: readonly StagedMove[]
    /** "1 of 4 moved", where the step states its limit. */
    readonly tally?: string
}

/**
 * R-4.6 What a push or a pull has staged, from the bench's own picks: each item's count, its
 * piece, the area it leaves and the area its ghosts land in, as the bench draws them. Nothing here
 * reads a rule: where a thing lands is the preview's, through the ghosts.
 */
export function stagedMoves(view: BenchView, bench: BenchOffer): StagedMoves | undefined {
    if (bench.staged.length === 0) {
        return undefined
    }
    const from = GuildById[bench.areas[0] ?? bench.guild].name
    const landing = (item: string) => {
        const area = view.areas.find((one) => one.ghosts.some((ghost) => ghost.item === item))
        const ghost =
            area?.ghosts.find((one) => one.item === item) ??
            view.tray.find((one) => one.item === item)
        return { to: area ? GuildById[area.guild].name : undefined, piece: ghost?.piece }
    }
    const moved = bench.staged.reduce((sum, { count }) => sum + count, 0)
    return {
        lines: bench.staged.map(({ item, label, count, takeBack }) => {
            const { to, piece } = landing(item)
            const what = piece?.kind === 'good' ? `${count} ${piece.good}` : `${count} ${label}`
            // A good or a row's marker is drawn beside it, so the line counts it and says where it goes.
            const drawn = piece && (item.startsWith('good:') || item.startsWith('row:'))
            const shown = drawn ? `${count}` : what
            return {
                item,
                ...(piece ? { piece } : {}),
                text: to && to !== from ? `${shown} · ${from} → ${to}` : `${shown} · ${from}`,
                words:
                    to && to !== from
                        ? `${what} from the ${from} to the ${to}`
                        : `${what} on the ${from}`,
                takeBack
            }
        }),
        ...(bench.most === undefined ? {} : { tally: `${moved} of ${bench.most} moved` })
    }
}
