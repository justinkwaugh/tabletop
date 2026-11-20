import {
    ActionCardKinds,
    ActionCards,
    ExtraActionHandSize,
    Goods,
    MilitaryServiceTrack,
    PlayerDiscRoles,
    RegionTiles,
    VesselTypes,
    WineBarrelCapacity,
    beadValue,
    type ActionCardKind,
    type BeadValue,
    type Good,
    type HydratedFeudumGameState,
    type HydratedFeudumPlayerState,
    type LandscapeKind,
    type PlayedCard,
    type PouchGood,
    type RegionId,
    type TileEpoch,
    type TileId,
    type VesselType,
    type WritId,
    coveredServiceSpaces,
    voyageSpaceOf
} from '@tabletop/feudum'
import { handFaceShown, writFaceShown } from './perspective.js'
import { deckNoteOf } from './watching.js'

export interface SeatRibbon {
    readonly name: string
    readonly score: number
    /** R-6 The seat holds the top score, alone or tied, and some seat scores less. */
    readonly leading: boolean
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

/**
 * R-3.1, R-3.2, R-5.1 For another seat `handBacks` counts the hand and no face is read. While the
 * seat's own desk shows its hand (its card-play turn), its panel says only how many (`handOnDesk`);
 * otherwise the panel shows its faces. Host View's look at another seat shows the hand's faces; the
 * set-aside cards are never on the panel.
 */
export interface SeatCards {
    readonly played: readonly SeatPlayedCard[]
    readonly handFaces: readonly SeatCardFace[]
    readonly handBacks: number
    /** R-3.1 How many cards the seat holds: public, for every seat alike. */
    readonly handCount: number
    readonly handOnDesk: boolean
}

export type SeatPouch =
    | { readonly status: 'empty' | 'choosing' }
    /** R-3.1-H1 Another seat's hand is final, its pouch unseen until every hand is. */
    | { readonly status: 'sealed' }
    | { readonly status: 'drafted' | 'committed'; readonly good: PouchGood }
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

export interface SeatPanelView {
    readonly playerId: string
    readonly ribbon: SeatRibbon
    readonly cards: SeatCards
    readonly pouch: SeatPouch
    readonly supply: SeatSupply
    readonly writs: SeatWrits
    readonly barrel: { readonly sulfur: number; readonly capacity: number }
    /** R-1.1 Pawns off the board, in the seat's supply. */
    readonly pawnsInSupply: number
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
    /** R-3.1 The viewer's desk shows its hand now, so its own panel need not. */
    readonly handOnDesk?: boolean
}

/** R-2.2.5 The seat order stays as the marker passes, so the panels keep their places. */
export function seatOrder(state: HydratedFeudumGameState): readonly string[] {
    return state.players.map(({ playerId }) => playerId)
}

/** R-6 The seats holding the top score while some seat scores less: none while every score is level. */
export function leadersOf(state: HydratedFeudumGameState): ReadonlySet<string> {
    const scores = state.players.map(({ score }) => score)
    const top = Math.max(...scores)
    if (scores.every((score) => score === top)) {
        return new Set()
    }
    return new Set(
        state.players.filter(({ score }) => score === top).map(({ playerId }) => playerId)
    )
}

export interface ScoreLineSeat {
    readonly playerId: string
    readonly name: string
    readonly score: number
    readonly leading: boolean
}

/** Contract, Supply: the desk zoom row's score line: every seat in turn order, its score, the leader marked. */
export function scoreLineOf(
    state: HydratedFeudumGameState,
    nameOf: (playerId: string) => string
): readonly ScoreLineSeat[] {
    const leaders = leadersOf(state)
    return seatOrder(state).map((playerId) => ({
        playerId,
        name: nameOf(playerId),
        score: state.getPlayerState(playerId).score,
        leading: leaders.has(playerId)
    }))
}

/** R-6 A score in words, as its accessible name and tooltip read it. */
export function scoreWords(score: number, leading: boolean): string {
    return `${score} vp${leading ? ', leading' : ''}`
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
    player: HydratedFeudumPlayerState,
    look: 'own' | 'faces' | 'backs',
    deskShowsHand: boolean
): SeatCards {
    const played = player.played.map((card) => ({ ...faceOf(card.kind), mark: markOf(card) }))
    const { handCount } = player
    const handOnDesk = look === 'own' && deskShowsHand
    const facesShown = look === 'faces' || (look === 'own' && !handOnDesk)
    return {
        played,
        handFaces: facesShown ? (player.hand ?? []).map((kind) => faceOf(kind)) : [],
        handBacks: look === 'backs' ? handCount : 0,
        handCount,
        handOnDesk
    }
}

function pouchOf(
    state: HydratedFeudumGameState,
    player: HydratedFeudumPlayerState,
    drafted: PouchGood | undefined,
    owner: boolean
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
    if (owner && player.committedPouch) {
        // R-3.1-H1 Its own committed good, which no other seat sees until every hand is final.
        return { status: 'committed', good: player.committedPouch }
    }
    if (!state.flow.selection) {
        return { status: 'empty' }
    }
    if (handChosen(state, player)) {
        // R-3.1-H1 Whether a good went in is the seat's own until the reveal.
        return owner ? { status: 'empty' } : { status: 'sealed' }
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

/** R-3.1-H1 A seat's pouch as one viewer's panel shows it; the viewer's own draft shows to it alone. */
export function seatPouchOf(
    state: HydratedFeudumGameState,
    playerId: string,
    viewerId: string | undefined,
    draftedPouch?: PouchGood
): SeatPouch {
    const isOwner = viewerId === playerId
    return pouchOf(
        state,
        state.getPlayerState(playerId),
        isOwner ? draftedPouch : undefined,
        isOwner
    )
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
    draftedPouch,
    handOnDesk = false
}: SeatPanelInput): SeatPanelView {
    const player = state.getPlayerState(playerId)
    const isOwner = viewerId === playerId
    const voyage = voyageSpaceOf(state, playerId)?.space
    return {
        playerId,
        ribbon: {
            name: nameOf(playerId),
            score: player.score,
            leading: leadersOf(state).has(playerId),
            turnNumeral: state.turnManager.turnOrder.indexOf(playerId) + 1,
            startPlayer: state.startingPlayerId === playerId,
            deciding: state.activePlayerIds.includes(playerId)
        },
        cards: cardsOf(
            player,
            handFaceShown(viewerId, playerId) ? 'own' : hostView ? 'faces' : 'backs',
            handOnDesk
        ),
        pouch: seatPouchOf(state, playerId, viewerId, draftedPouch),
        supply: supplyOf(state, player),
        writs: writsOf(state, player, hostView || writFaceShown(viewerId, playerId), isOwner),
        barrel: { sulfur: player.barrel, capacity: WineBarrelCapacity },
        pawnsInSupply: player.pawns.filter(({ spaceId }) => spaceId === undefined).length,
        service: {
            covered: coveredServiceSpaces(state, playerId).length,
            of: MilitaryServiceTrack.length,
            vassal: state.isVassal(playerId)
        },
        ...(voyage === undefined ? {} : { voyage })
    }
}
