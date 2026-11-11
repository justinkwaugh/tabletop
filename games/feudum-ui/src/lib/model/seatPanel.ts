import {
    ActionCardKinds,
    ActionCards,
    ExtraActionHandSize,
    Goods,
    GuildIds,
    MilitaryServiceTrack,
    PlayerDiscRoles,
    RegionTiles,
    VesselTypes,
    WineBarrelCapacity,
    beadValue,
    rankOf,
    type ActionCardKind,
    type BeadValue,
    type Good,
    type GuildId,
    type GuildRank,
    type HydratedFeudumGameState,
    type HydratedFeudumPlayerState,
    type LandscapeKind,
    type PlayedCard,
    type PouchGood,
    type RegionId,
    type TileEpoch,
    type TileId,
    type VesselType,
    type WritId
} from '@tabletop/feudum'
import { handFaceShown, writFaceShown } from './perspective.js'
import { deckNoteOf } from './watching.js'

export interface SeatRibbon {
    readonly name: string
    readonly score: number
    readonly turnNumeral: number
    readonly startPlayer: boolean
    readonly deciding: boolean
}

export interface SeatCardFace {
    readonly kind: ActionCardKind
    readonly number: number
    readonly name: string
}

export interface SeatPlayedCard extends SeatCardFace {
    readonly mark: string
}

export interface SeatUnplayedCard extends SeatCardFace {
    readonly setAside: boolean
}

/**
 * R-3.1, R-3.2, R-5.1 For another seat `unplayed` is empty and `handBacks` counts the hand; for the
 * owner `unplayed` holds every card not played and `handBacks` is 0.
 */
export interface SeatCards {
    readonly played: readonly SeatPlayedCard[]
    readonly unplayed: readonly SeatUnplayedCard[]
    readonly handBacks: number
    /** R-3.1 How many cards the seat holds: public, for every seat alike. */
    readonly handCount: number
}

export type SeatPouch =
    | { readonly status: 'empty' | 'choosing' }
    | { readonly status: 'drafted'; readonly good: PouchGood }
    | {
          readonly status: 'finalised'
          readonly good: PouchGood
          readonly note: 'extra action' | 'sequential'
          readonly spent: boolean
      }

export interface SeatTile {
    readonly tileId: TileId
    readonly epoch: TileEpoch
    readonly region: RegionId
    readonly landscape: LandscapeKind
}

export interface SeatSupply {
    readonly goods: readonly { readonly good: Good; readonly count: number }[]
    readonly shillings: number
    readonly markers: number
    readonly freeDiscs: number
    readonly discsOf: number
    readonly vessels: readonly { readonly vessel: VesselType; readonly count: number }[]
    readonly tiles: readonly SeatTile[]
    readonly beads: readonly BeadValue[]
    /** R-5-H1 Only a count, for everyone: no one knows a held seal's value. */
    readonly seals: number
}

/** R-4.4.4 For another seat only the backs; for the owner only the faces. */
export interface SeatWrits {
    readonly backs: number
    readonly sealedBacks: number
    readonly faces: readonly WritId[]
    readonly sealedFaces: readonly WritId[]
    readonly deckNote?: string
}

export type RankBadge = 'M' | 'J' | 'A'

export interface SeatGuildCrest {
    readonly guild: GuildId
    readonly stars: number
    readonly rank?: RankBadge
    readonly reeve: boolean
    /** R-4.5.2 Stars, but no marker in supply to stand on the track. */
    readonly noMarker: boolean
    /** R-4.5.3, R-1.4.9 Stars and a marker in supply, but outranked: no place on the track. */
    readonly outranked: boolean
}

export interface SeatPanelView {
    readonly playerId: string
    readonly ribbon: SeatRibbon
    readonly cards: SeatCards
    readonly pouch: SeatPouch
    readonly supply: SeatSupply
    readonly writs: SeatWrits
    readonly barrel: { readonly sulfur: number; readonly capacity: number }
    readonly guilds: readonly SeatGuildCrest[]
    readonly service: { readonly covered: number; readonly of: number; readonly vassal: boolean }
    /** R-3.7.5 Absent: this seat's disc has not set out. */
    readonly voyage?: number
}

export interface SeatPanelInput {
    readonly state: HydratedFeudumGameState
    readonly playerId: string
    readonly viewerId: string | undefined
    /** S57 Host View's explicit look at the faces. */
    readonly hostView?: boolean
    readonly nameOf: (playerId: string) => string
    /** R-3.3 The viewer's own draft of the pouch good, before it is finalised. */
    readonly draftedPouch?: PouchGood
}

/** R-2.2.5 The seat order stays as the marker passes, so the panels keep their places. */
export function seatOrder(state: HydratedFeudumGameState): readonly string[] {
    return state.players.map(({ playerId }) => playerId)
}

const RankBadges: Readonly<Record<GuildRank, RankBadge>> = {
    master: 'M',
    journeyman: 'J',
    apprentice: 'A'
}

function printedNameOf(kind: ActionCardKind): string {
    return ActionCards.find((card) => card.kind === kind)?.printedName ?? kind
}

function faceOf(kind: ActionCardKind): SeatCardFace {
    return { kind, number: ActionCardKinds.indexOf(kind) + 1, name: printedNameOf(kind) }
}

/** R-3.2, R-3.15 How a card was used, as public state has it. */
function markOf({ use, replayedKind, dejaVu }: PlayedCard): string {
    if (replayedKind) {
        return `${dejaVu ? 'Déjà Vu' : 'replayed'} ${printedNameOf(replayedKind)}`
    }
    return use === 'defend-flip' ? 'flipped as Defend' : use
}

/** R-3.1-H1 Who has finalised is public. Outside a selection a chosen hand has left a trace. */
function handChosen(state: HydratedFeudumGameState, player: HydratedFeudumPlayerState): boolean {
    const { selection } = state.flow
    return selection
        ? selection.finalised.includes(player.playerId)
        : player.handCount > 0 || player.played.length > 0
}

function cardsOf(
    state: HydratedFeudumGameState,
    player: HydratedFeudumPlayerState,
    facesShown: boolean
): SeatCards {
    const played = player.played.map((card) => ({ ...faceOf(card.kind), mark: markOf(card) }))
    if (!facesShown) {
        return { played, unplayed: [], handBacks: player.handCount, handCount: player.handCount }
    }
    const hand = player.hand ?? []
    const chosen = handChosen(state, player)
    const unplayed = ActionCardKinds.filter(
        (kind) => !player.played.some((card) => card.kind === kind)
    ).map((kind) => ({ ...faceOf(kind), setAside: chosen && !hand.includes(kind) }))
    return { played, unplayed, handBacks: 0, handCount: player.handCount }
}

function pouchOf(
    state: HydratedFeudumGameState,
    player: HydratedFeudumPlayerState,
    drafted: PouchGood | undefined
): SeatPouch {
    if (player.pouch === 'saltpeter') {
        return {
            status: 'finalised',
            good: player.pouch,
            note: 'extra action',
            spent: player.played.length >= ExtraActionHandSize
        }
    }
    if (player.pouch === 'sulfur') {
        return {
            status: 'finalised',
            good: player.pouch,
            note: 'sequential',
            spent: player.sequentialUsed
        }
    }
    if (!state.flow.selection || handChosen(state, player)) {
        return { status: 'empty' }
    }
    return drafted ? { status: 'drafted', good: drafted } : { status: 'choosing' }
}

function supplyOf(state: HydratedFeudumGameState, player: HydratedFeudumPlayerState): SeatSupply {
    return {
        goods: Goods.map((good) => ({ good, count: player.goods[good] })),
        shillings: player.shillings,
        markers: player.influenceSupply,
        freeDiscs: state.freeDiscs(player.playerId),
        discsOf: PlayerDiscRoles.shared,
        vessels: VesselTypes.map((vessel) => ({ vessel, count: player.vessels[vessel] })),
        tiles: player.regionTiles.flatMap((tileId) => {
            const tile = RegionTiles.find(({ id }) => id === tileId)
            const landscape = state.tileLandscapes[tileId]
            return tile && landscape
                ? [{ tileId, epoch: tile.epoch, region: tile.region, landscape }]
                : []
        }),
        beads: player.beads.map((sealId) => beadValue(sealId)),
        seals: player.sealCount
    }
}

function writsOf(
    state: HydratedFeudumGameState,
    player: HydratedFeudumPlayerState,
    facesShown: boolean,
    deckNoteShown: boolean
): SeatWrits {
    const deckNote = deckNoteShown ? deckNoteOf(state, player.playerId) : undefined
    return {
        backs: facesShown ? 0 : player.writCount - player.sealedCharterCount,
        sealedBacks: facesShown ? 0 : player.sealedCharterCount,
        faces: facesShown ? (player.writs ?? []) : [],
        sealedFaces: facesShown ? (player.sealedCharters ?? []) : [],
        ...(deckNote ? { deckNote } : {})
    }
}

function crestsOf(state: HydratedFeudumGameState, playerId: string): readonly SeatGuildCrest[] {
    return GuildIds.map((guild) => {
        const track = state.guilds.tracks[guild]
        const rank = rankOf(track, playerId)
        const stars = state.statusStars(playerId, guild)
        const placeless = stars > 0 && rank === undefined
        const hasMarker = state.getPlayerState(playerId).influenceSupply > 0
        return {
            guild,
            stars,
            ...(rank ? { rank: RankBadges[rank] } : {}),
            reeve: rank !== undefined && (track[rank]?.reeve ?? false),
            noMarker: placeless && !hasMarker,
            outranked: placeless && hasMarker
        }
    })
}

/**
 * Contract, Seat panel: one seat as one viewer sees it, for every view of that seat. Nothing hidden
 * is read unless this viewer may see it, whatever the state happens to hold, so what it returns for
 * another seat cannot carry a face.
 */
export function seatPanelOf({
    state,
    playerId,
    viewerId,
    hostView = false,
    nameOf,
    draftedPouch
}: SeatPanelInput): SeatPanelView {
    const player = state.getPlayerState(playerId)
    const isOwner = viewerId === playerId
    const voyage = state.voyageTrack[playerId]
    return {
        playerId,
        ribbon: {
            name: nameOf(playerId),
            score: player.score,
            turnNumeral: state.turnManager.turnOrder.indexOf(playerId) + 1,
            startPlayer: state.startingPlayerId === playerId,
            deciding: state.activePlayerIds.includes(playerId)
        },
        cards: cardsOf(state, player, hostView || handFaceShown(viewerId, playerId)),
        pouch: pouchOf(state, player, isOwner ? draftedPouch : undefined),
        supply: supplyOf(state, player),
        writs: writsOf(state, player, hostView || writFaceShown(viewerId, playerId), isOwner),
        barrel: { sulfur: player.barrel, capacity: WineBarrelCapacity },
        guilds: crestsOf(state, playerId),
        service: {
            covered: state.militaryService[playerId] ?? 0,
            of: MilitaryServiceTrack.length,
            vassal: state.isVassal(playerId)
        },
        ...(voyage === undefined ? {} : { voyage })
    }
}
