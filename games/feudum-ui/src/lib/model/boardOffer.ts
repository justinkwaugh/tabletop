import {
    ActionType,
    MachineState,
    StartingSpaceIds,
    type GuildId,
    type HydratedFeudumGameState,
    type MonsterId,
    type PawnNumber,
    type PieceRef,
    type PilferResource,
    type PilferSource,
    type RegionId,
    type RouteMedium,
    type SpaceId
} from '@tabletop/feudum'

/** What a board layer can be asked about. Later picks add their element kinds here. */
export type BoardTarget =
    | `space:${SpaceId}`
    | `pawn:${string}:${PawnNumber}`
    | `monster:${MonsterId}`
    | `feudum:${SpaceId}`
    | `marker:${SpaceId}:${string}:${string}`
    | `stack:${RegionId}`
    | `pilfer:${SpaceId}:${PilferSource}:${PilferResource}`
    | `guild:${GuildId}`

/** R-3.16 A guild's area of the board. */
export function guildTarget(guildId: GuildId): BoardTarget {
    return `guild:${guildId}`
}

export function spaceTarget(spaceId: SpaceId): BoardTarget {
    return `space:${spaceId}`
}

export function pawnTarget(playerId: string, n: PawnNumber): BoardTarget {
    return `pawn:${playerId}:${n}`
}

export function monsterTarget(monsterId: MonsterId): BoardTarget {
    return `monster:${monsterId}`
}

export function feudumTarget(spaceId: SpaceId): BoardTarget {
    return `feudum:${spaceId}`
}

export function markerTarget(spaceId: SpaceId, playerId: string, role: string): BoardTarget {
    return `marker:${spaceId}:${playerId}:${role}`
}

export function stackTarget(region: RegionId): BoardTarget {
    return `stack:${region}`
}

/** R-3.7.1 A pawn or a monster, whichever the step names. */
export function pieceTarget(piece: PieceRef): BoardTarget {
    return piece.kind === 'pawn'
        ? pawnTarget(piece.playerId, piece.n)
        : monsterTarget(piece.monsterId)
}

/** R-3.7.4 One resource a piece that moved may take, where it now stands. */
export function pilferTarget(
    spaceId: SpaceId,
    from: PilferSource,
    resource: PilferResource
): BoardTarget {
    return `pilfer:${spaceId}:${from}:${resource}`
}

export type BoardRole = 'lit' | 'picked' | 'being-decided' | 'dimmed' | 'plain'

export type ChipKind = 'cost' | 'threat' | 'role' | 'gain'
export type ChipTone = 'rose' | 'amber'

export interface ChipNote {
    readonly kind: ChipKind
    readonly label: string
}

export interface BoardChip extends ChipNote {
    readonly tone: ChipTone
}

/** Contract, Coexistence and precedence: a cost or threat wins over a role, a role over a gain. */
const ChipPrecedence: readonly ChipKind[] = ['cost', 'threat', 'role', 'gain']
const RoseChips: readonly ChipKind[] = ['cost', 'threat']

/** The one chip a target shows of everything a pick says about it. */
export function strongestChip(notes: readonly ChipNote[]): BoardChip | undefined {
    const note = notes.toSorted(
        (a, b) => ChipPrecedence.indexOf(a.kind) - ChipPrecedence.indexOf(b.kind)
    )[0]
    return note && { ...note, tone: RoseChips.includes(note.kind) ? 'rose' : 'amber' }
}

export interface PickTarget {
    readonly target: BoardTarget
    readonly notes?: readonly ChipNote[]
    /** Named for its chip alone: dimmed, and a press does nothing (R-4.2.4). */
    readonly unlit?: boolean
}

/** R-3.7.1, R-3.7.3 One step staged but not sent: the numbered trail. */
export interface TrailStep {
    /** "1", "2": press order. */
    readonly n: number
    readonly piece: PieceRef
    readonly from: SpaceId
    readonly to: SpaceId
    readonly medium: RouteMedium
    /** Drawn lighter. */
    readonly godspeed?: boolean
}

/** An open pick on the map: what one seat chooses among, in the displayed state. */
export interface MapPick {
    readonly action: ActionType
    readonly deciderId: string
    readonly targets: readonly PickTarget[]
    readonly picked: readonly BoardTarget[]
    /** Others and History View see the outline only where the choice is public. */
    readonly isPublic: boolean
    /** The deciding seat's staged steps. */
    readonly trail?: readonly TrailStep[]
}

/** A draft's open pick, as the session hands it to the board. */
export interface StagePick {
    readonly targets: readonly PickTarget[]
    readonly picked: readonly BoardTarget[]
    readonly trail?: readonly TrailStep[]
}

/** The drafts' stages a pick reads. Each is read only while its flow applies. */
export interface BoardStages {
    readonly startingPawnSpace?: SpaceId
    /** The turn draft's open flow, for this seat alone (R-3.2). */
    readonly cardPick?: StagePick
    /** The Move draft's open stage, in place of the flow's, which hands a Move off (R-3.7). */
    readonly movePick?: StagePick
    readonly guildPick?: StagePick
}

/** R-1.4.9 The six starting spaces, lit from the start since either order is allowed (S2). */
function startingPawnPick(
    state: HydratedFeudumGameState,
    stages: BoardStages
): MapPick | undefined {
    const deciderId = state.flow.setupOrder?.playerId
    if (!deciderId) {
        return undefined
    }
    return {
        action: ActionType.PlaceStartingPawn,
        deciderId,
        targets: StartingSpaceIds.map((spaceId) => ({ target: spaceTarget(spaceId) })),
        picked: stages.startingPawnSpace ? [spaceTarget(stages.startingPawnSpace)] : [],
        isPublic: true
    }
}

/** R-3.2 What the open flow lights. The choice is the deciding seat's until it is sent. */
function cardPlayPick(state: HydratedFeudumGameState, stages: BoardStages): MapPick | undefined {
    const deciderId = state.flow.turn?.playerId
    const pick = stages.guildPick ?? stages.movePick ?? stages.cardPick
    return deciderId && pick
        ? {
              action: ActionType.ForfeitCard,
              deciderId,
              ...pick,
              isPublic: false
          }
        : undefined
}

/** One row per machine state with a map pick; a later draft adds its row and its stages. */
const MapPicks: Partial<
    Record<
        MachineState,
        (state: HydratedFeudumGameState, stages: BoardStages) => MapPick | undefined
    >
> = {
    [MachineState.PlacingStartingPawn]: startingPawnPick,
    [MachineState.PlayingCards]: cardPlayPick
}

export function openMapPick(
    state: HydratedFeudumGameState,
    stages: BoardStages
): MapPick | undefined {
    return MapPicks[state.machineState]?.(state, stages)
}

export interface BoardTargetOffer {
    readonly role: BoardRole
    readonly chip?: BoardChip
}

export interface BoardOffer {
    readonly targets: ReadonlyMap<BoardTarget, BoardTargetOffer>
    /** A map pick is open for this seat, so everything it doesn't name dims. */
    readonly dimsRest: boolean
    /** This seat's staged steps; absent for anyone else (R-X.1). */
    readonly trail?: readonly TrailStep[]
}

export const NoBoardOffer: BoardOffer = { targets: new Map(), dimsRest: false }

export function roleOf(offer: BoardOffer, target: BoardTarget): BoardRole {
    return offer.targets.get(target)?.role ?? (offer.dimsRest ? 'dimmed' : 'plain')
}

export function chipOf(offer: BoardOffer, target: BoardTarget): BoardChip | undefined {
    return offer.targets.get(target)?.chip
}

export interface BoardViewer {
    readonly viewerId?: string
    /** The displayed state's valid actions for this seat. */
    readonly validActions: readonly string[]
    readonly viewingHistory: boolean
    readonly updatingVisibleState: boolean
}

function deciderRole(pick: MapPick, target: BoardTarget, unlit?: boolean): BoardRole {
    if (unlit) {
        return 'dimmed'
    }
    return pick.picked.includes(target) ? 'picked' : 'lit'
}

/** A pick as one viewer sees it (contract: Coexistence and precedence). Pure. */
export function offerOfPick(pick: MapPick | undefined, viewer: BoardViewer): BoardOffer {
    if (viewer.updatingVisibleState || !pick) {
        return NoBoardOffer
    }
    const isDecider = pick.deciderId === viewer.viewerId
    if (!viewer.viewingHistory && isDecider && viewer.validActions.includes(pick.action)) {
        return {
            targets: new Map(
                pick.targets.map(({ target, notes, unlit }) => {
                    const chip = strongestChip(notes ?? [])
                    const role = deciderRole(pick, target, unlit)
                    return [target, { role, ...(chip ? { chip } : {}) }]
                })
            ),
            dimsRest: pick.targets.length > 0,
            ...(pick.trail ? { trail: pick.trail } : {})
        }
    }
    if (!pick.isPublic || (isDecider && !viewer.viewingHistory)) {
        return NoBoardOffer
    }
    return {
        targets: new Map(
            pick.targets.flatMap(({ target, unlit }) =>
                unlit ? [] : [[target, { role: 'being-decided' }]]
            )
        ),
        dimsRest: false
    }
}

/** The board offer: derived, never stored, from the displayed state, valid actions and stages. */
export function deriveBoardOffer(
    state: HydratedFeudumGameState,
    stages: BoardStages,
    viewer: BoardViewer
): BoardOffer {
    return offerOfPick(openMapPick(state, stages), viewer)
}
