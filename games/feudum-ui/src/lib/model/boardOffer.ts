import {
    ActionType,
    MachineState,
    StartingSpaceIds,
    type Good,
    type GuildId,
    type HydratedFeudumGameState,
    type LocationKind,
    type MonsterId,
    type PawnNumber,
    placeDiscOffer,
    reasonPlaceDiscRefused,
    type PlaceDiscOffer,
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
    | `voyage:${number}`
    | `military:${number}`

/** R-3.16 A guild's area of the board. */
export function guildTarget(guildId: GuildId): BoardTarget {
    return `guild:${guildId}`
}

/** R-3.7.5 A space of the epic voyage track. */
export function voyageTarget(space: number): BoardTarget {
    return `voyage:${space}`
}

/** R-4.9.1 A space of the military service track. */
export function militaryTarget(space: number): BoardTarget {
    return `military:${space}`
}

/** R-4.7, R-4.9.1, R-3.7.5 Where the disc asked about would go. */
export function discTarget(offer: PlaceDiscOffer): BoardTarget {
    switch (offer.disc) {
        case 'reeve': {
            return guildTarget(offer.guildId)
        }
        case 'military': {
            return militaryTarget(offer.space)
        }
        case 'voyage': {
            return voyageTarget(offer.space)
        }
    }
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

/**
 * One piece of a chip drawn as art: a good or a seal with its count, a location disc, or the arrow
 * of a step from one disc to the next.
 */
export type ChipArt =
    | { readonly kind: 'good'; readonly good: Good; readonly count: number }
    | { readonly kind: 'seal'; readonly count: number }
    | { readonly kind: 'disc'; readonly location: LocationKind }
    | { readonly kind: 'step' }

export interface ChipNote {
    readonly kind: ChipKind
    /** The chip's words, and its accessible name when it is drawn as art. */
    readonly label: string
    /** Drawn as these pieces in place of the words: "farm → town, iron 1". */
    readonly art?: readonly ChipArt[]
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
    /** R-X.1 An ask's outline: the decider answers on its panel, so nothing lights for it. */
    readonly outlineOnly?: true
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
    /** The at-will row's open list, for this seat alone (R-4.4-H1). */
    readonly atWillPick?: StagePick & { readonly action: ActionType; readonly deciderId: string }
    /** R-4.10, R-4.10-H4 For the seat deciding on this screen: several decide at once. */
    readonly nourishPick?: StagePick & { readonly deciderId: string }
    /** R-4.3.4 */
    readonly landscapesPick?: StagePick
    /** R-X.2 A placement that can't be undone is staged. */
    readonly discPlacing?: boolean
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

/** R-4.4-H1 The at-will row's open list, private until it is sent. */
function atWillMapPick(stages: BoardStages): MapPick | undefined {
    return stages.atWillPick && { ...stages.atWillPick, isPublic: false }
}

/** R-3.14.1 The combat's target is outlined for all while the defender answers on its panel. */
function defencePick(state: HydratedFeudumGameState): MapPick | undefined {
    const { combat } = state.flow
    if (!combat?.defenderId) {
        return undefined
    }
    const { target, spaceId, defenderId } = combat
    return {
        action: ActionType.AnswerAttack,
        deciderId: defenderId,
        targets: [
            { target: target.kind === 'feudum' ? feudumTarget(spaceId) : pieceTarget(target) }
        ],
        picked: [],
        isPublic: true,
        outlineOnly: true
    }
}

/** R-3.14.2 The starved marker is outlined for all while its owner answers. */
function immunityPick(state: HydratedFeudumGameState): MapPick | undefined {
    const { starve } = state.flow
    return (
        starve && {
            action: ActionType.AnswerStarve,
            deciderId: starve.targetPlayerId,
            targets: [{ target: markerTarget(starve.spaceId, starve.targetPlayerId, starve.role) }],
            picked: [],
            isPublic: true,
            outlineOnly: true
        }
    )
}

/** R-4.7, R-4.9.1, R-3.7.5 Where the disc would go: public, so others see it being decided. */
function discPick(state: HydratedFeudumGameState, stages: BoardStages): MapPick | undefined {
    const [deciderId] = state.activePlayerIds
    const offer = deciderId ? placeDiscOffer(state, deciderId) : undefined
    if (!offer) {
        return undefined
    }
    const target = discTarget(offer)
    return {
        action: ActionType.PlaceDisc,
        deciderId,
        targets: [
            {
                target,
                ...(reasonPlaceDiscRefused(state, deciderId, true) ? { unlit: true } : {})
            }
        ],
        picked: stages.discPlacing ? [target] : [],
        isPublic: true
    }
}

/** One row per machine state with a map pick; a later draft adds its row and its stages. */
const MapPicks: Partial<
    Record<
        MachineState,
        (state: HydratedFeudumGameState, stages: BoardStages) => MapPick | undefined
    >
> = {
    [MachineState.PlacingStartingPawn]: startingPawnPick,
    [MachineState.PlayingCards]: (state, stages) =>
        atWillMapPick(stages) ?? cardPlayPick(state, stages),
    [MachineState.SelectingHands]: (_state, stages) => atWillMapPick(stages),
    [MachineState.DiscardingWrits]: (_state, stages) => atWillMapPick(stages),
    [MachineState.Nourishing]: (_state, stages) =>
        atWillMapPick(stages) ??
        (stages.nourishPick
            ? { action: ActionType.Nourish, ...stages.nourishPick, isPublic: false }
            : undefined),
    [MachineState.CollectingLandscapes]: (state, stages) => {
        const deciderId = state.flow.landscapes?.pending[0]
        return deciderId && stages.landscapesPick
            ? {
                  action: ActionType.CollectLandscapes,
                  deciderId,
                  ...stages.landscapesPick,
                  isPublic: false
              }
            : undefined
    },
    [MachineState.PlacingDisc]: discPick,
    [MachineState.AwaitingDefence]: defencePick,
    [MachineState.AwaitingImmunity]: immunityPick
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
    if (
        !pick.outlineOnly &&
        !viewer.viewingHistory &&
        isDecider &&
        viewer.validActions.includes(pick.action)
    ) {
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
