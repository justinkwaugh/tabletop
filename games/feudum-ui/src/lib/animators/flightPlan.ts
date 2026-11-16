import type { GameAction } from '@tabletop/common'
import {
    ChickenSpaces,
    type ChickenSpaceId,
    FarmerPurse,
    Goods,
    GuildTrackSpaces,
    KnightMonsterIcons,
    MonkCoffer,
    ScrollSpaces,
    Spaces,
    beadValue,
    hiddenBeadCandidates,
    isCommitAttack,
    isExplore,
    isFeast,
    isGuildAction,
    isKeepWrits,
    isMigrate,
    isMove,
    isPlaceDisc,
    isPlayMandate,
    tileById,
    type BeadValue,
    type Character,
    type Good,
    type HydratedFeudumGameState,
    type LandscapeKind,
    type RegionId,
    type SealId,
    type TileEpoch,
    type TileId,
    type WritId
} from '@tabletop/feudum'
import { writFaceShown } from '$lib/model/perspective.js'
import {
    GoodSize,
    GuildSizes,
    ImmunitySealSize,
    LandscapeSize,
    MarkerSize,
    PawnSize,
    StackCentres,
    StackSize,
    SupplyCorner,
    SupplyToken,
    guildSlot,
    knightCell,
    rosaryBead,
    spaceGeometry,
    type Point
} from '$lib/utils/boardGeometry.js'
import {
    FastSeconds,
    FlipSeconds,
    GoodFlight,
    GoodGap,
    GuildScale,
    goodsOffTheBoard,
    guildPoint,
    keyOfRef,
    placedPieces
} from './boardPlan.js'

/** Contract, Animation plan: what a moving copy is, one row for each. */
export type FlightRow =
    'pawns' | 'markers' | 'goods' | 'shillings' | 'tiles' | 'writs' | 'seals' | 'score'

/**
 * What a moving copy draws. A writ's back carries no id, by type: nothing in the layer's markup can name
 * a writ a seat may not see. A seal carries no id either: red side up they are all the same disc (R-5-H1).
 */
export type FlightFace =
    | { readonly kind: 'good'; readonly good: Good }
    | { readonly kind: 'marker'; readonly playerId: string }
    | { readonly kind: 'pawn'; readonly playerId: string; readonly character: Character }
    | { readonly kind: 'shilling' }
    | {
          readonly kind: 'tile'
          readonly faceShown: boolean
          readonly epoch: TileEpoch
          readonly region: RegionId
          readonly landscape?: LandscapeKind
      }
    | { readonly kind: 'writ'; readonly faceShown: true; readonly writId: WritId }
    | { readonly kind: 'writ'; readonly faceShown: false }
    | { readonly kind: 'seal' }
    | { readonly kind: 'bead'; readonly value: BeadValue }
    /** R-6 A score change: the seat's disc carrying what it gained or lost. */
    | { readonly kind: 'score'; readonly playerId: string; readonly change: number }

/** Which part of a seat a copy leaves or reaches. */
export type SeatPart =
    | { readonly part: 'good'; readonly good: Good }
    | {
          readonly part:
              'barrel' | 'pouch' | 'shillings' | 'markers' | 'pawns' | 'writs' | 'seals' | 'score'
      }
    | { readonly part: 'tile'; readonly tileId: TileId }
    | { readonly part: 'writ'; readonly writId: WritId }
    | { readonly part: 'bead'; readonly value: BeadValue }

/**
 * Where a copy stands: a place on the board, a part of a seat, a writ the action panel offers, or over
 * the middle of the table. `hide`: what stands there is the copy's source and is hidden while it flies.
 */
export type FlightEnd =
    | {
          readonly kind: 'board'
          readonly point: Point
          readonly size: number
          readonly piece?: string
          readonly hide?: boolean
      }
    | {
          readonly kind: 'seat'
          readonly playerId: string
          readonly part: SeatPart
          readonly hide?: boolean
      }
    | {
          readonly kind: 'offer'
          readonly playerId: string
          readonly writId?: WritId
          readonly hide?: boolean
      }
    | { readonly kind: 'table'; readonly size?: number }

export interface FlightLeg {
    readonly to: FlightEnd
    readonly at: number
    readonly duration: number
    readonly arc?: boolean
    /** The copy turns over on this leg, and shows this after. */
    readonly turnTo?: FlightFace
    /** The copy fades on this leg: a removed tile (R-4.3). */
    readonly fade?: boolean
}

export interface Flight {
    readonly id: string
    readonly row: FlightRow
    readonly face: FlightFace
    readonly from: FlightEnd
    readonly legs: readonly FlightLeg[]
    /** R-3.6 A rose flash on the source before it leaves: a pawn conquered or unfed. */
    readonly flash?: { readonly at: number; readonly duration: number }
}

export interface FlightPlan {
    readonly flights: readonly Flight[]
    readonly seconds: number
}

export interface FlightChange {
    readonly from: HydratedFeudumGameState
    readonly to: HydratedFeudumGameState
    /** Absent, the plan is the fast fallback, and draws nothing an Action would have told it. */
    readonly action?: GameAction
    readonly viewerId?: string
    /** Contract, Animation plan: the board draws no score ring (a desk), so each score flies to its seat. */
    readonly scoreFlights?: boolean
}

const CopySeconds = 0.45
const RowGap = 0.05
const FlashSeconds = 0.3
const PlayedHold = 0.6
const LiftSeconds = 0.3
const LiftHold = 0.3
const LiftRise = 24
const CoinsPerLegMost = 3
const BeadSize = GuildSizes.bead * GuildScale
const RosaryBeadSize = BeadSize
const ScrollSealSize = ImmunitySealSize

/** Contract, Supply: the deck, the seal pile and the haversack fly from and to the board's corner. */
const Deck: FlightEnd = { kind: 'board', point: SupplyCorner, size: SupplyToken }
const SealPile: FlightEnd = { kind: 'board', point: SupplyCorner, size: SupplyToken }
/** R-1.1 The general supply: goods and coin alike leave and reach the haversack, at the corner. */
const GeneralSupply: FlightEnd = { kind: 'board', point: SupplyCorner, size: SupplyToken }

/** A good drawn at its own size, leaving or reaching the haversack. */
const Haversack: FlightEnd = { kind: 'board', point: SupplyCorner, size: GoodSize }

class FlightBuilder {
    readonly flights: Flight[] = []

    add(
        row: FlightRow,
        face: FlightFace,
        from: FlightEnd,
        legs: readonly FlightLeg[],
        flash?: Flight['flash']
    ): number {
        this.flights.push({
            id: `${row}-${this.flights.length}`,
            row,
            face,
            from,
            legs,
            ...(flash ? { flash } : {})
        })
        return Math.max(...legs.map(({ at, duration }) => at + duration))
    }

    /** One straight or arced leg, starting at `at`. */
    fly(
        row: FlightRow,
        face: FlightFace,
        from: FlightEnd,
        to: FlightEnd,
        at: number,
        extra: Partial<FlightLeg> = {}
    ): number {
        return this.add(row, face, from, [{ to, at, duration: CopySeconds, arc: true, ...extra }])
    }
}

function seatOf(playerId: string, part: SeatPart, hide = false): FlightEnd {
    return { kind: 'seat', playerId, part, ...(hide ? { hide } : {}) }
}

/**
 * R-4.1, R-4.2 A pawn's place on the map, in the slots the map shows; a space too full to show it sends
 * the copy to the space's middle.
 */
function pawnPlace(state: HydratedFeudumGameState, key: string, spaceId: string): Point {
    const placed = placedPieces(state).get(key)?.point
    const space = Spaces.find(({ id }) => id === spaceId)
    return placed ?? (space ? spaceGeometry(space.id).centre : SupplyCorner)
}

/** R-3.6 Pawns reach the map from a seat, turn their face as they land, and fly back home. */
function pawnsEntering(plan: FlightBuilder, { from, to }: FlightChange, at: number): number {
    let launch = at
    let ends = at
    for (const player of to.players) {
        const before = from.getPlayerState(player.playerId)
        for (const pawn of player.pawns) {
            const was = before.pawns.find(({ n }) => n === pawn.n)
            if (was?.spaceId || !pawn.spaceId || !pawn.character) {
                continue
            }
            const key = `pawn:${player.playerId}:${pawn.n}`
            const face = {
                kind: 'pawn',
                playerId: player.playerId,
                character: pawn.character
            } as const
            ends = plan.fly(
                'pawns',
                face,
                seatOf(player.playerId, { part: 'pawns' }),
                { kind: 'board', point: pawnPlace(to, key, pawn.spaceId), size: PawnSize },
                launch,
                { turnTo: face }
            )
            launch += GoodGap
        }
    }
    return ends
}

function pawnsGoingHome(plan: FlightBuilder, change: FlightChange, at: number): number {
    const { from, to, action } = change
    // R-3.6 A pawn leaving by its own Migrate takes no flash; one conquered or unfed does.
    const flashes = action !== undefined && !isMigrate(action)
    let launch = at
    let ends = at
    for (const player of from.players) {
        const after = to.getPlayerState(player.playerId)
        for (const pawn of player.pawns) {
            const now = after.pawns.find(({ n }) => n === pawn.n)
            if (!pawn.spaceId || now?.spaceId || !pawn.character) {
                continue
            }
            const key = `pawn:${player.playerId}:${pawn.n}`
            const leaves = flashes ? launch + FlashSeconds : launch
            ends = plan.add(
                'pawns',
                { kind: 'pawn', playerId: player.playerId, character: pawn.character },
                {
                    kind: 'board',
                    point: pawnPlace(from, key, pawn.spaceId),
                    size: PawnSize,
                    piece: key,
                    hide: true
                },
                [
                    {
                        to: seatOf(player.playerId, { part: 'pawns' }),
                        at: leaves,
                        duration: CopySeconds,
                        arc: true
                    }
                ],
                flashes ? { at: launch, duration: FlashSeconds } : undefined
            )
            launch += GoodGap
        }
    }
    return ends
}

interface MarkerPlace {
    readonly piece: string
    readonly point: Point
    readonly size: number
    readonly slide?: string
}

/** R-4.1.2, R-4.5, R-4.8 Where a seat's markers stand, by the key the board draws each under. */
function markerPlaces(
    state: HydratedFeudumGameState,
    playerId: string
): ReadonlyMap<string, MarkerPlace> {
    const places = new Map<string, MarkerPlace>()
    const put = (place: MarkerPlace) => places.set(place.piece, place)
    for (const { id } of Spaces) {
        const { ruler, serf } = state.spaces[id]
        const geometry = spaceGeometry(id)
        const role = (name: 'ruler' | 'subject' | 'serf') =>
            put({
                piece: `marker:${id}:${name}`,
                point: geometry[name],
                size: MarkerSize,
                slide: id
            })
        if (ruler?.playerId === playerId) {
            role('ruler')
            if (ruler.subject) {
                role('subject')
            }
        }
        if (serf?.playerId === playerId) {
            role('serf')
        }
    }
    const scaled = GuildSizes.marker * GuildScale
    for (const space of GuildTrackSpaces) {
        if (state.guilds.tracks[space.guild][space.rank]?.playerId === playerId) {
            put({
                piece: `rank:${space.id}`,
                point: guildPoint(space.guild, guildSlot(space.id)),
                size: scaled,
                slide: space.guild
            })
        }
    }
    for (const row of state.guilds.knight.rows) {
        if (row.playerId === playerId) {
            for (let column = 1; column <= row.markers; column += 1) {
                put({
                    piece: `knight:${row.colour}:${column}`,
                    point: guildPoint('knight', knightCell(row.colour, column)),
                    size: scaled
                })
            }
        }
    }
    return places
}

/**
 * R-4.1.2, R-4.5.2, R-4.8 A marker from a seat lands on its place; one returned flies home. What slides
 * within a space or a guild's track, what fills a Knight row and what moves onto a monster's icon are
 * the board's own motions: nothing here draws those a second time.
 */
function flyMarkers(plan: FlightBuilder, { from, to }: FlightChange, at: number): number {
    let launch = at
    let ends = at
    const fly = (playerId: string, source: FlightEnd, target: FlightEnd) => {
        ends = plan.fly('markers', { kind: 'marker', playerId }, source, target, launch)
        launch += GoodGap
    }
    for (const player of to.players) {
        const { playerId } = player
        const before = markerPlaces(from, playerId)
        const after = markerPlaces(to, playerId)
        const lost = [...before.values()].filter(({ piece }) => !after.has(piece))
        const gained = [...after.values()].filter(({ piece }) => !before.has(piece))
        const slidTo = new Set(lost.map(({ slide }) => slide).filter(Boolean))
        const slidFrom = new Set(gained.map(({ slide }) => slide).filter(Boolean))
        const iconed = KnightMonsterIcons.filter(
            ({ monster }) =>
                to.guilds.knight.monsterIcons[monster] === playerId &&
                from.guilds.knight.monsterIcons[monster] !== playerId
        ).length
        const row = from.guilds.knight.rows.find((one) => one.playerId === playerId)
        const onIcon = new Set(
            row
                ? Array.from(
                      { length: iconed },
                      (_, index) => `knight:${row.colour}:${row.markers - index}`
                  )
                : []
        )
        const left = to.getPlayerState(playerId).influenceSupply === 0
        for (const place of gained) {
            if (place.piece.startsWith('knight:') || (place.slide && slidTo.has(place.slide))) {
                continue
            }
            fly(playerId, seatOf(playerId, { part: 'markers' }, left), {
                kind: 'board',
                point: place.point,
                size: place.size
            })
        }
        for (const place of lost) {
            if ((place.slide && slidFrom.has(place.slide)) || onIcon.has(place.piece)) {
                continue
            }
            fly(
                playerId,
                {
                    kind: 'board',
                    point: place.point,
                    size: place.size,
                    piece: place.piece,
                    hide: true
                },
                seatOf(playerId, { part: 'markers' })
            )
        }
    }
    return ends
}

interface GoodMove {
    readonly good: Good
    readonly end: FlightEnd
}

/** R-3.7.4 Where a pilfered good's last leg starts: on the piece that took it. */
function pilferedGood({
    to,
    action
}: FlightChange): (GoodMove & { readonly fromSpace: boolean }) | undefined {
    if (!action || !isMove(action) || !action.pilfer) {
        return undefined
    }
    const { piece, resource, from: source } = action.pilfer
    const good = Goods.find((one) => one === resource)
    const landing = placedPieces(to).get(keyOfRef(piece))?.point
    return good && landing
        ? {
              good,
              fromSpace: source === 'space',
              end: { kind: 'board', point: landing, size: GoodSize }
          }
        : undefined
}

/**
 * R-1.1, R-3.3, R-4.10.2 Goods between the board, a seat, its barrel and its pouch, one after another a
 * few frames apart. Only counts are read, and the pouch's good once the seat has finalised (R-3.3): a
 * draft is the session's, and never reaches a plan.
 */
function flyGoods(plan: FlightBuilder, change: FlightChange, at: number): number {
    const { from, to, action } = change
    const board = goodsOffTheBoard({ from, to }, action)
    const pilfered = pilferedGood(change)
    let launch = at
    let ends = at
    for (const good of Goods) {
        const sources: FlightEnd[] = []
        const targets: FlightEnd[] = []
        if (pilfered?.good === good) {
            sources.push(pilfered.end)
        }
        for (const player of to.players) {
            const { playerId } = player
            const before = from.getPlayerState(playerId)
            const held = player.goods[good] - before.goods[good]
            for (let times = held; times < 0; times += 1) {
                sources.push(seatOf(playerId, { part: 'good', good }, player.goods[good] === 0))
            }
            for (let times = held; times > 0; times -= 1) {
                targets.push(seatOf(playerId, { part: 'good', good }))
            }
            if (good === 'sulfur') {
                const barrel = player.barrel - before.barrel
                for (let times = barrel; times < 0; times += 1) {
                    sources.push(seatOf(playerId, { part: 'barrel' }))
                }
                for (let times = barrel; times > 0; times -= 1) {
                    targets.push(seatOf(playerId, { part: 'barrel' }))
                }
            }
            if (player.pouch === good && before.pouch !== good) {
                targets.push(seatOf(playerId, { part: 'pouch' }))
            }
            if (before.pouch === good && player.pouch !== good) {
                sources.push(seatOf(playerId, { part: 'pouch' }, true))
            }
        }
        const leaving = board.leaving.filter((one) => one.good === good)
        const skipped = pilfered?.good === good && !pilfered.fromSpace ? 1 : 0
        for (const { place } of leaving.slice(skipped)) {
            sources.push({
                kind: 'board',
                point: place.point,
                size: GoodSize,
                ...(place.key ? { piece: place.key, hide: true } : {})
            })
        }
        for (const { good: reached, place } of board.arriving) {
            if (reached === good) {
                targets.push({ kind: 'board', point: place.point, size: GoodSize })
            }
        }
        const crossings = Math.max(sources.length, targets.length)
        for (let index = 0; index < crossings; index += 1) {
            const source = sources[index] ?? Haversack
            const target = targets[index] ?? Haversack
            ends = plan.add('goods', { kind: 'good', good }, source, [
                { to: target, at: launch, duration: GoodFlight, arc: true }
            ])
            launch += GoodGap
        }
    }
    return ends
}

interface CoinHolder {
    readonly end: FlightEnd
    readonly change: number
    readonly seat?: string
}

/** R-4.6.2 Coin moves payer to master, journeyman and charity in order; what is left comes after. */
function flyShillings(plan: FlightBuilder, { from, to, action }: FlightChange, at: number): number {
    const seats: CoinHolder[] = to.players.map((player) => ({
        end: seatOf(player.playerId, { part: 'shillings' }, player.shillings === 0),
        change: player.shillings - from.getPlayerState(player.playerId).shillings,
        seat: player.playerId
    }))
    const farmer = guildPoint('farmer', guildSlot(FarmerPurse.id))
    const monk = guildPoint('monk', guildSlot(MonkCoffer.id))
    const places: CoinHolder[] = [
        {
            end: { kind: 'board', point: farmer, size: GoodSize, piece: 'purse' },
            change: to.guilds.farmer.purse - from.guilds.farmer.purse
        },
        {
            end: { kind: 'board', point: monk, size: GoodSize, piece: 'coffer' },
            change: to.guilds.monk.coffer - from.guilds.monk.coffer
        },
        { end: GeneralSupply, change: to.supply.shillings - from.supply.shillings }
    ]
    const payment = action && isGuildAction(action) ? action.metadata?.payment : undefined
    const inOrder = payment?.members.map(({ playerId }) => playerId) ?? []
    const rank = ({ seat }: CoinHolder) => {
        const index = seat === undefined ? -1 : inOrder.indexOf(seat)
        return index < 0 ? inOrder.length : index
    }
    const holders = [...seats.toSorted((a, b) => rank(a) - rank(b)), ...places]
    const payers = holders.filter(({ change }) => change < 0)
    const payees = holders.filter(({ change }) => change > 0)
    let launch = at
    let ends = at
    for (const payee of payees) {
        const source = payers[0]?.end ?? GeneralSupply
        for (let coin = 0; coin < Math.min(payee.change, CoinsPerLegMost); coin += 1) {
            ends = plan.fly('shillings', { kind: 'shilling' }, source, payee.end, launch)
            launch += GoodGap
        }
    }
    // Nobody received it on the table: it goes to the supply, one coin to say so.
    for (const payer of payers) {
        if (payees.length === 0) {
            ends = plan.fly('shillings', { kind: 'shilling' }, payer.end, GeneralSupply, launch)
            launch += GoodGap
        }
    }
    return ends
}

function tileFace(tileId: TileId, shown: boolean, state: HydratedFeudumGameState): FlightFace {
    const { epoch, region } = tileById(tileId)
    const landscape = state.tileLandscapes[tileId]
    return {
        kind: 'tile',
        faceShown: shown,
        epoch,
        region,
        ...(shown && landscape ? { landscape } : {})
    }
}

/**
 * R-4.3 A tile flies from its stack, or the space that held it, to a seat; a landscape flips to its back
 * as it lands on a space; a tile spent or removed fades where it stood.
 */
function flyTiles(plan: FlightBuilder, { from, to }: FlightChange, at: number): number {
    let launch = at
    let ends = at
    const spaceHolding = (state: HydratedFeudumGameState, tileId: TileId) =>
        Spaces.find(({ id }) => state.spaces[id].landscape?.tileId === tileId)?.id
    const fade = (face: FlightFace, source: FlightEnd) => {
        ends = plan.add('tiles', face, source, [
            { to: source, at: launch, duration: FlipSeconds, fade: true }
        ])
        launch += GoodGap
    }
    for (const player of to.players) {
        const before = from.getPlayerState(player.playerId).regionTiles
        for (const tileId of player.regionTiles.filter((one) => !before.includes(one))) {
            const { region } = tileById(tileId)
            const space = spaceHolding(from, tileId)
            const landing = seatOf(player.playerId, { part: 'tile', tileId })
            const shown = tileFace(tileId, true, to)
            if (space) {
                ends = plan.fly(
                    'tiles',
                    tileFace(tileId, false, to),
                    {
                        kind: 'board',
                        point: spaceGeometry(space).landscape,
                        size: LandscapeSize,
                        piece: `landscape:${space}`,
                        hide: true
                    },
                    landing,
                    launch,
                    { turnTo: shown }
                )
            } else {
                ends = plan.fly(
                    'tiles',
                    tileFace(tileId, false, to),
                    {
                        kind: 'board',
                        point: StackCentres[region],
                        size: StackSize,
                        piece: `stack:${region}`,
                        hide: to.regionStacks[region].length === 0
                    },
                    landing,
                    launch,
                    { turnTo: shown }
                )
            }
            launch += GoodGap
        }
        for (const tileId of before.filter((one) => !player.regionTiles.includes(one))) {
            const source = seatOf(player.playerId, { part: 'tile', tileId }, true)
            const space = spaceHolding(to, tileId)
            if (space) {
                ends = plan.fly(
                    'tiles',
                    tileFace(tileId, true, from),
                    source,
                    {
                        kind: 'board',
                        point: spaceGeometry(space).landscape,
                        size: LandscapeSize
                    },
                    launch,
                    { turnTo: tileFace(tileId, false, to) }
                )
                launch += GoodGap
            } else {
                fade(tileFace(tileId, true, from), source)
            }
        }
    }
    for (const { id } of Spaces) {
        const tileId = from.spaces[id].landscape?.tileId
        if (!tileId || to.spaces[id].landscape?.tileId === tileId) {
            continue
        }
        const held = to.players.some((player) => player.regionTiles.includes(tileId))
        if (!held) {
            fade(tileFace(tileId, false, from), {
                kind: 'board',
                point: spaceGeometry(id).landscape,
                size: LandscapeSize,
                piece: `landscape:${id}`,
                hide: true
            })
        }
    }
    return ends
}

function drawnWritIdsOf(action?: GameAction): readonly WritId[] {
    if (
        isExplore(action) ||
        isGuildAction(action) ||
        isFeast(action) ||
        isPlaceDisc(action) ||
        isKeepWrits(action)
    ) {
        return action.metadata?.drawnWritIds ?? []
    }
    return []
}

function shownWrits(action?: GameAction): { playerId: string; writId: WritId }[] {
    const playerId = action?.playerId
    if (playerId === undefined) {
        return []
    }
    if (isPlayMandate(action)) {
        return [{ playerId, writId: action.writId }]
    }
    return isCommitAttack(action)
        ? (action.weapons ?? []).map(({ writId }) => ({ playerId, writId }))
        : []
}

const WritBack: FlightFace = { kind: 'writ', faceShown: false }

/**
 * R-4.4.1, R-4.4-H2, R-4.4-H3 What flies is decided by public counts alone, so the same copies leave at
 * the same moments at every seat. A writ's face is the only difference: a drawn writ shows to its drawer,
 * by `writFaceShown` and only if the Action as this seat received it names it; R-4.4.2, R-5.3 a writ
 * played or used as a weapon is public, shows over the table and goes under the deck. R-4.4.4 A
 * discarded writ goes under face down: its back flies from the seat to the deck, the same at every seat.
 * R-4.4.3, R-4.4-H6 A charter is sealed unseen at game end: no flight says which writ, or that one moved.
 */
function flyWrits(plan: FlightBuilder, change: FlightChange, at: number): number {
    const { from, to, action, viewerId } = change
    let launch = at
    let ends = at
    const accounted = new Map<string, number>()
    const account = (playerId: string, count: number) =>
        accounted.set(playerId, (accounted.get(playerId) ?? 0) + count)

    for (const { playerId, writId } of shownWrits(action)) {
        const face: FlightFace = { kind: 'writ', faceShown: true, writId }
        account(playerId, -1)
        const toTable = launch + CopySeconds
        ends = plan.add('writs', face, seatOf(playerId, { part: 'writ', writId }, true), [
            { to: { kind: 'table' }, at: launch, duration: CopySeconds },
            { to: Deck, at: toTable + PlayedHold, duration: CopySeconds }
        ])
        launch += GoodGap
    }

    if (action && isKeepWrits(action) && action.metadata) {
        const { playerId } = action
        const { keptCount, returnedCount } = action.metadata
        const known = writFaceShown(viewerId, playerId) ? (action.keep ?? []) : []
        account(playerId, keptCount)
        for (let index = 0; index < keptCount; index += 1) {
            const writId = known.at(index)
            ends = plan.fly(
                'writs',
                writId ? { kind: 'writ', faceShown: true, writId } : WritBack,
                {
                    kind: 'offer',
                    playerId,
                    ...(writId ? { writId } : {}),
                    hide: true
                },
                seatOf(playerId, { part: 'writs' }),
                launch
            )
            launch += GoodGap
        }
        for (let index = 0; index < returnedCount; index += 1) {
            ends = plan.fly(
                'writs',
                WritBack,
                { kind: 'offer', playerId, hide: true },
                Deck,
                launch
            )
            launch += GoodGap
        }
    }

    const drawing = to.flow.writDraw
    const redrew = action !== undefined && isKeepWrits(action) && action.metadata?.drawnCount
    if (drawing && (!from.flow.writDraw || redrew)) {
        const shown = writFaceShown(viewerId, drawing.playerId) ? drawnWritIdsOf(action) : []
        for (let index = 0; index < drawing.drawnCount; index += 1) {
            const writId = shown.at(index)
            ends = plan.fly(
                'writs',
                writId ? { kind: 'writ', faceShown: true, writId } : WritBack,
                Deck,
                seatOf(drawing.playerId, { part: 'writs' }),
                launch
            )
            launch += GoodGap
        }
    }

    for (const player of to.players) {
        const before = from.getPlayerState(player.playerId).writCount
        const unaccounted = player.writCount - before - (accounted.get(player.playerId) ?? 0)
        for (let times = unaccounted; times > 0; times -= 1) {
            ends = plan.fly(
                'writs',
                WritBack,
                Deck,
                seatOf(player.playerId, { part: 'writs' }),
                launch
            )
            launch += GoodGap
        }
        for (let times = unaccounted; times < 0; times += 1) {
            ends = plan.fly(
                'writs',
                WritBack,
                seatOf(player.playerId, { part: 'writs' }),
                Deck,
                launch
            )
            launch += GoodGap
        }
    }
    return ends
}

type BeadSpot =
    | { readonly at: 'seat'; readonly playerId: string }
    | { readonly at: 'rosary'; readonly index: number }
    | { readonly at: 'chicken'; readonly space: ChickenSpaceId }

function beadSpots(state: HydratedFeudumGameState): ReadonlyMap<SealId, BeadSpot> {
    const spots = new Map<SealId, BeadSpot>()
    state.guilds.monk.rosary.forEach((sealId, index) => {
        spots.set(sealId, { at: 'rosary', index })
    })
    for (const { id: space } of ChickenSpaces) {
        const sealId = state.guilds.farmer.chickens[space]
        if (sealId) {
            spots.set(sealId, { at: 'chicken', space })
        }
    }
    for (const { playerId, beads } of state.players) {
        for (const sealId of beads) {
            spots.set(sealId, { at: 'seat', playerId })
        }
    }
    return spots
}

function samePlace(a: BeadSpot, b: BeadSpot): boolean {
    if (a.at === 'seat' && b.at === 'seat') {
        return a.playerId === b.playerId
    }
    return a.at === b.at
}

function boardPointOfBead(spot: Exclude<BeadSpot, { at: 'seat' }>): Point {
    if (spot.at === 'rosary') {
        return guildPoint('monk', rosaryBead(spot.index))
    }
    return guildPoint('farmer', guildSlot(spot.space))
}

function beadEnd(sealId: SealId, spot: BeadSpot, source: boolean): FlightEnd {
    if (spot.at === 'seat') {
        return seatOf(spot.playerId, { part: 'bead', value: beadValue(sealId) }, source)
    }
    return {
        kind: 'board',
        point: boardPointOfBead(spot),
        size: spot.at === 'rosary' ? RosaryBeadSize : BeadSize,
        ...(source ? { piece: `bead:${sealId}`, hide: true } : {})
    }
}

interface ConcealedPlace {
    readonly end: FlightEnd
    readonly seat?: string
    /** The board slides a seal in under its marker; nothing flies for it. */
    readonly silent?: boolean
}

/** What public state says of where red-side-up seals left and arrived: places and counts, no ids. */
function concealedChanges({ from, to }: FlightChange) {
    const lost: ConcealedPlace[] = []
    const gained: ConcealedPlace[] = []
    const shift = (change: number, place: ConcealedPlace) => {
        for (let times = change; times < 0; times += 1) {
            lost.push(place)
        }
        for (let times = change; times > 0; times -= 1) {
            gained.push(place)
        }
    }
    for (const player of to.players) {
        const before = from.getPlayerState(player.playerId)
        const seat = player.playerId
        shift(player.sealCount - before.sealCount, {
            seat,
            end: seatOf(seat, { part: 'seals' }, player.sealCount === 0)
        })
        // R-4.4-H6 A seal under a charter lies with the writ: that it was sealed is the seat's count.
        shift(player.sealedCharterCount - before.sealedCharterCount, {
            seat,
            silent: true,
            end: seatOf(seat, { part: 'seals' })
        })
    }
    for (const space of ScrollSpaces) {
        const had = from.guilds.noble.scrolls[space.id] ? 1 : 0
        const has = to.guilds.noble.scrolls[space.id] ? 1 : 0
        shift(has - had, {
            end: {
                kind: 'board',
                point: guildPoint('noble', guildSlot(space.id)),
                size: ScrollSealSize,
                ...(had ? { piece: `seal:${space.id}`, hide: true } : {})
            }
        })
    }
    shift(to.supply.sealPileCount - from.supply.sealPileCount, { end: SealPile })
    for (const { id } of Spaces) {
        // R-4.1-H1 A serf's marker that becomes the subject keeps its seal: the count stands, no flight.
        const immunity = (state: HydratedFeudumGameState) =>
            (state.spaces[id].serf?.immune ? 1 : 0) +
            (state.spaces[id].ruler?.subjectImmune ? 1 : 0)
        const geometry = spaceGeometry(id)
        const under = from.spaces[id].serf?.immune ? geometry.serf : geometry.subject
        shift(immunity(to) - immunity(from), {
            silent: immunity(to) > immunity(from),
            end: {
                kind: 'board',
                point: { x: under.x, y: under.y + MarkerSize / 2 },
                size: ImmunitySealSize
            }
        })
    }
    return { lost, gained }
}

function takeFor(places: ConcealedPlace[], playerId: string | undefined) {
    const index = places.findIndex(({ seat, silent }) => !silent && seat === playerId)
    const found = index >= 0 ? index : places.findIndex(({ silent }) => !silent)
    return found >= 0 ? places.splice(found, 1)[0] : undefined
}

/**
 * R-4.6-H2 The two candidates lift together, the same height and for the same time whichever is drawn, so
 * nothing shows before the one settles: then it goes on and the other returns, in the same time again.
 */
function liftCandidates(
    plan: FlightBuilder,
    candidates: { readonly high: SealId; readonly low: SealId },
    drawn: SealId,
    goesTo: BeadSpot,
    from: HydratedFeudumGameState,
    at: number
): number {
    const settles = at + LiftSeconds + LiftHold
    let ends = at
    for (const sealId of [candidates.low, candidates.high]) {
        const spot = beadSpots(from).get(sealId)
        if (!spot || spot.at === 'seat') {
            continue
        }
        const home = beadEnd(sealId, spot, false)
        const place = boardPointOfBead(spot)
        const lifted: FlightEnd = {
            kind: 'board',
            point: { x: place.x, y: place.y - LiftRise },
            size: BeadSize
        }
        ends = plan.add(
            'seals',
            { kind: 'bead', value: beadValue(sealId) },
            beadEnd(sealId, spot, true),
            [
                { to: lifted, at, duration: LiftSeconds },
                {
                    to: sealId === drawn ? beadEnd(sealId, goesTo, false) : home,
                    at: settles,
                    duration: CopySeconds
                }
            ]
        )
    }
    return ends
}

/**
 * R-5-H1 Seals and beads. A bead's value is public wherever it lies. A red-side-up seal is one more
 * anonymous disc, known by places and counts alone. A seal flips where it lies to show its bead, then
 * moves; R-3.11.2 a bead back to a seat or the pile turns to its seal side.
 */
function flySeals(plan: FlightBuilder, change: FlightChange, at: number): number {
    const { from, to } = change
    const was = beadSpots(from)
    const now = beadSpots(to)
    const { lost, gained } = concealedChanges(change)
    const candidates = hiddenBeadCandidates(from)
    let launch = at
    let ends = at
    let lifted = false
    for (const [sealId, spot] of now) {
        const earlier = was.get(sealId)
        const face: FlightFace = { kind: 'bead', value: beadValue(sealId) }
        if (earlier && samePlace(earlier, spot)) {
            continue
        }
        if (
            earlier?.at === 'rosary' &&
            candidates &&
            !lifted &&
            change.action &&
            (sealId === candidates.high || sealId === candidates.low)
        ) {
            lifted = true
            ends = liftCandidates(plan, candidates, sealId, spot, from, launch)
        } else if (earlier) {
            ends = plan.fly(
                'seals',
                face,
                beadEnd(sealId, earlier, true),
                beadEnd(sealId, spot, false),
                launch
            )
        } else {
            const place = spot.at === 'seat' ? spot.playerId : undefined
            const source = takeFor(lost, place)?.end ?? SealPile
            ends = plan.add('seals', { kind: 'seal' }, source, [
                { to: source, at: launch, duration: FlipSeconds, turnTo: face },
                {
                    to: beadEnd(sealId, spot, false),
                    at: launch + FlipSeconds,
                    duration: CopySeconds,
                    arc: true
                }
            ])
        }
        launch += GoodGap
    }
    for (const [sealId, spot] of was) {
        if (now.has(sealId)) {
            continue
        }
        const place = spot.at === 'seat' ? spot.playerId : undefined
        const target = takeFor(gained, place)?.end ?? SealPile
        ends = plan.fly(
            'seals',
            { kind: 'bead', value: beadValue(sealId) },
            beadEnd(sealId, spot, true),
            target,
            launch,
            { turnTo: { kind: 'seal' } }
        )
        launch += GoodGap
    }
    const movers = gained.filter(({ silent }) => !silent)
    const leavers = lost.filter(({ silent }) => !silent)
    for (let index = 0; index < Math.min(movers.length, leavers.length); index += 1) {
        ends = plan.fly('seals', { kind: 'seal' }, leavers[index].end, movers[index].end, launch)
        launch += GoodGap
    }
    return ends
}

function secondsOf(flights: readonly Flight[]): number {
    return flights.reduce(
        (longest, { legs }) => Math.max(longest, ...legs.map(({ at, duration }) => at + duration)),
        0
    )
}

/**
 * Contract, Animation plan: one row after another, the order the scenarios name: a pawn, then its marker
 * (S2); a tile, then the goods it yields (S17); goods, then an unfed pawn (S53); beads last (S20).
 */
export function planFlights(change: FlightChange): FlightPlan {
    const plan = new FlightBuilder()
    const rows = [
        pawnsEntering,
        flyMarkers,
        flyTiles,
        flyGoods,
        flyShillings,
        pawnsGoingHome,
        flyWrits,
        flySeals,
        flyScores
    ]
    let cursor = 0
    for (const row of rows) {
        const ends = row(plan, change, cursor)
        cursor = ends > cursor ? ends + RowGap : cursor
    }
    return { flights: plan.flights, seconds: secondsOf(plan.flights) }
}

/** The disc that carries a score change over the table: about a seat panel's score's size. */
const ScoreCopySize = 40

/**
 * R-6 Where the board draws no score ring (a desk), each seat whose score changed sends its disc,
 * carrying the change, from over the table to its seat panel's score, in turn order, last of all.
 */
function flyScores(plan: FlightBuilder, { from, to, scoreFlights }: FlightChange, at: number) {
    if (!scoreFlights) {
        return at
    }
    let launch = at
    let ends = at
    for (const player of to.players) {
        const change = player.score - from.getPlayerState(player.playerId).score
        if (change !== 0) {
            ends = plan.fly(
                'score',
                { kind: 'score', playerId: player.playerId, change },
                { kind: 'table', size: ScoreCopySize },
                seatOf(player.playerId, { part: 'score' }),
                launch
            )
            launch += GoodGap
        }
    }
    return ends
}

/**
 * Fast fallback: every copy straight to its end at once, within the bound, flips, holds, lifts, flashes
 * and fades cut. With no Action in hand no writ's face can be named: every writ is a back.
 */
export function planDirectFlights(change: Omit<FlightChange, 'action'>): FlightPlan {
    const { flights } = planFlights({
        from: change.from,
        to: change.to,
        ...(change.scoreFlights ? { scoreFlights: true } : {})
    })
    const direct = flights.map((flight): Flight => {
        const last = flight.legs[flight.legs.length - 1]
        const turned = flight.legs.flatMap(({ turnTo }) => (turnTo ? [turnTo] : [])).at(-1)
        return {
            id: flight.id,
            row: flight.row,
            face: turned ?? flight.face,
            from: flight.from,
            legs: [{ to: last.to, at: 0, duration: FastSeconds }]
        }
    })
    return { flights: direct, seconds: secondsOf(direct) }
}
