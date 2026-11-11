import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { assertExists, GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { RouteMedia, Routes, type RouteMedium, type SpaceId } from '../data/board.js'
import { Goods, MonsterIds, type Good } from '../data/components.js'
import { Landscapes, type Landscape } from '../data/regionTiles.js'
import { ActionType } from '../definition/actions.js'
import { PieceRef } from '../model/flow.js'
import { queueFollowUp } from '../model/followUps.js'
import { HydratedFeudumGameState } from '../model/gameState.js'
import { RankChange } from '../model/guildStatus.js'
import type { SpaceState } from '../model/mapState.js'
import {
    abandonVessel,
    FerryFare,
    ferriesOpen,
    isPinned,
    monsterMayUse,
    monsterSteps,
    pawnRouteOptions,
    pawnSteps,
    placeVesselUnderPawn,
    routeBetween,
    vesselOfMedium,
    type RouteStep
} from '../model/media.js'
import type { PawnState } from '../model/playerState.js'
import {
    GoodSchema,
    GuildIdSchema,
    PawnNumberSchema,
    SpaceIdSchema,
    VesselTypeSchema
} from '../model/stateSchemas.js'
import {
    payShillingsToSupply,
    reasonSulfurToBarrelRefused,
    targetToMarker
} from '../model/supply.js'
import {
    CardPlayFields,
    playCard,
    reasonCardPlayRefused,
    reasonSpecialRefused,
    type CardPlayInput,
    type RepeatMode
} from './cardPlay.js'

/** R-3.7.5 The round's second successful move earns the voyage. */
const SuccessfulMovesForVoyage = 2

/** What every step names of its way. R-4.2.2 `vessel`: how a pawn takes one up to go. */
const WayFields = Type.Object({
    to: SpaceIdSchema,
    medium: Type.Enum([...RouteMedia]),
    vessel: Type.Optional(Type.Union([Type.Literal('board'), Type.Literal('place')])),
    /** R-4.2.3 The step pays `FerryFare`. */
    ferry: Type.Optional(Type.Literal(true))
})

/** R-3.7.1, R-4.2 One space along one route, in press order. */
export type MoveStep = Type.Static<typeof MoveStep>
export const MoveStep = Type.Object({ piece: PieceRef, ...WayFields.properties })

/** R-3.7.3 One monk's extra step, after the others. */
export type GodspeedStep = Type.Static<typeof GodspeedStep>
export const GodspeedStep = Type.Object({ pawn: PawnNumberSchema, ...WayFields.properties })

export type PilferSource = Type.Static<typeof PilferSource>
export const PilferSource = Type.Union([
    Type.Literal('space'),
    Type.Literal('farm'),
    Type.Literal('landscape')
])

/** R-3.7.4 A good, or what a landscape holds. */
export type PilferResource = Type.Static<typeof PilferResource>
export const PilferResource = Type.Union([
    GoodSchema,
    Type.Literal('shillings'),
    Type.Literal('targets')
])

/** R-3.7.4 One resource where the piece now stands. */
export type Pilfer = Type.Static<typeof Pilfer>
export const Pilfer = Type.Object({
    piece: PieceRef,
    from: PilferSource,
    resource: PilferResource,
    /** R-4.10.2 A pilfered sulfur goes to the barrel instead. */
    sulfurToBarrel: Type.Optional(Type.Literal(true))
})

/** What the input doesn't say of a step: the route, where from, and the vessels it touched. */
export type MoveStepRecord = Type.Static<typeof MoveStepRecord>
export const MoveStepRecord = Type.Object({
    routeId: Type.Enum(Routes.map((route) => route.id)),
    from: SpaceIdSchema,
    /** R-4.1 The character the pawn shows, for the sentence; absent for a monster. */
    character: Type.Optional(GuildIdSchema),
    /** R-4.2.2 The vessel the pawn rode this step. */
    vessel: Type.Optional(VesselTypeSchema),
    /** R-4.2.2 The vessel it stepped off, left on `from`. */
    left: Type.Optional(VesselTypeSchema),
    /** R-4.2.3 */
    fare: Type.Optional(Type.Integer({ minimum: 0 }))
})

export type MoveMetadata = Type.Static<typeof MoveMetadata>
export const MoveMetadata = Type.Object({
    steps: Type.Array(MoveStepRecord),
    godspeed: Type.Optional(MoveStepRecord),
    pilfer: Type.Optional(
        Type.Object({
            spaceId: SpaceIdSchema,
            /** R-4.3.4 A target became a marker; false: the seat had none left, so it was discarded. */
            marker: Type.Optional(Type.Boolean())
        })
    ),
    /** R-4.5.2 A pilfered target's marker goes straight onto a track the seat qualifies for. */
    rankChanges: Type.Optional(Type.Array(RankChange))
})

export type Move = Type.Static<typeof Move>
export const Move = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        CardPlayFields,
        Type.Object({
            type: Type.Literal(ActionType.Move),
            playerId: Type.String(),
            steps: Type.Array(MoveStep),
            godspeed: Type.Optional(GodspeedStep),
            pilfer: Type.Optional(Pilfer),
            metadata: Type.Optional(MoveMetadata)
        })
    ])
)

export const MoveValidator = Compile(Move)

export function isMove(action?: GameAction): action is Move {
    return action?.type === ActionType.Move
}

/** The stages of a Move drafted so far. */
export interface MoveDraft {
    readonly steps: readonly MoveStep[]
    readonly godspeed?: GodspeedStep
}

export type MoveInput = MoveDraft & { readonly pilfer?: Pilfer } & CardPlayInput

type PawnRef = Extract<PieceRef, { kind: 'pawn' }>
type MonsterRef = Extract<PieceRef, { kind: 'monster' }>

/** R-3.7.1 Pawns on the board plus monsters. */
export function moveAllowance(state: HydratedFeudumGameState, playerId: string): number {
    const pawns = state.getPlayerState(playerId).pawns.filter((pawn) => pawn.spaceId)
    const monsters = MonsterIds.filter((monster) => state.monsters[monster].playerId === playerId)
    return pawns.length + monsters.length
}

function pawnAt(state: HydratedFeudumGameState, piece: PawnRef): PawnState | undefined {
    return state.getPlayerState(piece.playerId).pawns.find((pawn) => pawn.n === piece.n)
}

function spaceOfPiece(state: HydratedFeudumGameState, piece: PieceRef): SpaceId | undefined {
    return piece.kind === 'pawn'
        ? pawnAt(state, piece)?.spaceId
        : state.monsters[piece.monsterId].spaceId
}

function samePiece(a: PieceRef, b: PieceRef): boolean {
    return a.kind === 'pawn'
        ? b.kind === 'pawn' && a.playerId === b.playerId && a.n === b.n
        : b.kind === 'monster' && a.monsterId === b.monsterId
}

/** R-3.7.3 Godspeed's step as the step it folds as. */
function godspeedAsStep(playerId: string, { pawn, ...way }: GodspeedStep): MoveStep {
    return { piece: { kind: 'pawn', playerId, n: pawn }, ...way }
}

function words(id: string): string {
    return id.replaceAll('-', ' ')
}

/** R-4.2 The way this step names, if the piece may take it where it now stands. */
function wayOfStep(
    state: HydratedFeudumGameState,
    playerId: string,
    step: MoveStep
): RouteStep | undefined {
    const { piece } = step
    const from = spaceOfPiece(state, piece)
    const route = from && routeBetween(from, step.to, step.medium)
    if (!route) {
        return undefined
    }
    if (piece.kind === 'pawn') {
        return pawnRouteOptions(state, playerId, piece.n, route).find(
            (way) => way.vessel === step.vessel && way.ferry === step.ferry
        )
    }
    return monsterMayUse(piece.monsterId, route) && !step.vessel && !step.ferry
        ? { route, to: step.to }
        : undefined
}

/** R-4.2 */
function reasonNoRoute(medium: RouteMedium): string {
    return medium === 'road'
        ? 'No road joins those spaces.'
        : `No ${words(medium)} route joins those spaces.`
}

/** R-4.2.2, R-4.2.3 Why a pawn may not go this way, once `pawnRouteOptions` has said it may not. */
function reasonWayClosed(state: HydratedFeudumGameState, playerId: string, step: MoveStep): string {
    if (step.medium === 'ferry') {
        if (!ferriesOpen(state)) {
            return 'Ferries run only while no vessel is for sale.'
        }
        return state.getPlayerState(playerId).shillings < FerryFare
            ? `A ferry costs ${FerryFare} shillings.`
            : 'A ferry step must name its fare.'
    }
    if (step.ferry) {
        return 'Only a ferry charges a fare.'
    }
    const vessel = vesselOfMedium(step.medium)
    if (!vessel) {
        return 'A road takes no vessel.'
    }
    const { piece } = step
    if (piece.kind === 'pawn' && pawnAt(state, piece)?.vessel === vessel) {
        return 'That pawn is already aboard.'
    }
    if (step.vessel === 'board') {
        const from = spaceOfPiece(state, piece)
        return from && state.spaces[from].vessels[vessel] > 0
            ? `That ${words(vessel)} was left this turn; it can be boarded on a later turn.`
            : `There is no ${words(vessel)} to board there.`
    }
    return step.vessel === 'place'
        ? `You have no ${words(vessel)} in your supply.`
        : `That pawn must board or place a ${words(vessel)}.`
}

/** R-4.2, R-4.2.4 */
function reasonPawnStepRefused(
    state: HydratedFeudumGameState,
    playerId: string,
    step: MoveStep,
    piece: PawnRef
): string | undefined {
    if (piece.playerId !== playerId) {
        return "That pawn isn't yours."
    }
    const from = pawnAt(state, piece)?.spaceId
    if (!from) {
        return "That pawn isn't on the board."
    }
    if (isPinned(state, playerId, piece.n)) {
        return 'A monster pins that pawn.'
    }
    if (!routeBetween(from, step.to, step.medium)) {
        return reasonNoRoute(step.medium)
    }
    return wayOfStep(state, playerId, step) ? undefined : reasonWayClosed(state, playerId, step)
}

/** R-4.2.4 A monster moves by its own media and never uses a vessel. */
function reasonMonsterStepRefused(
    state: HydratedFeudumGameState,
    playerId: string,
    step: MoveStep,
    piece: MonsterRef
): string | undefined {
    const { playerId: controller, spaceId: from } = state.monsters[piece.monsterId]
    if (controller !== playerId || !from) {
        return "That monster isn't yours."
    }
    if (step.vessel) {
        return 'Monsters never use vessels.'
    }
    const route = routeBetween(from, step.to, step.medium)
    if (!route) {
        return reasonNoRoute(step.medium)
    }
    if (!monsterMayUse(piece.monsterId, route)) {
        return `The ${words(piece.monsterId)} can't use that route.`
    }
    return step.ferry ? 'Only a ferry charges a fare.' : undefined
}

/** R-3.7.1, R-4.2 */
function reasonStepRefused(
    state: HydratedFeudumGameState,
    playerId: string,
    step: MoveStep
): string | undefined {
    const { piece } = step
    return piece.kind === 'pawn'
        ? reasonPawnStepRefused(state, playerId, step, piece)
        : reasonMonsterStepRefused(state, playerId, step, piece)
}

/**
 * R-4.2 Takes one step whose reason has passed: a pawn leaves any vessel the route doesn't use on
 * the space it leaves (R-4.2.2), takes up the one it names, and pays a ferry (R-4.2.3).
 */
function takeStep(
    state: HydratedFeudumGameState,
    playerId: string,
    step: MoveStep
): MoveStepRecord {
    const way = wayOfStep(state, playerId, step)
    assertExists(way, 'R-4.2 A step taken is a step allowed')
    const { piece } = step
    const from = spaceOfPiece(state, piece)
    assertExists(from, 'R-3.7.1 A piece stepping is on the board')
    const record: MoveStepRecord = { routeId: way.route.id, from }
    if (piece.kind === 'monster') {
        state.monsters[piece.monsterId].spaceId = way.to
        return record
    }
    const pawn = pawnAt(state, piece)
    assertExists(pawn, 'R-1.1 A seat has this pawn')
    record.character = pawn.character
    const player = state.getPlayerState(playerId)
    const rides = vesselOfMedium(way.route.medium)
    if (pawn.vessel && pawn.vessel !== rides) {
        abandonVessel(state, from, pawn.vessel)
        record.left = pawn.vessel
        pawn.vessel = undefined
    }
    if (rides) {
        if (way.vessel === 'place') {
            placeVesselUnderPawn(player, pawn, rides)
        } else {
            if (way.vessel === 'board') {
                state.spaces[from].vessels[rides] -= 1
            }
            pawn.vessel = rides
        }
        record.vessel = rides
    }
    if (way.ferry) {
        payShillingsToSupply(state, playerId, FerryFare)
        record.fare = FerryFare
    }
    pawn.spaceId = way.to
    return record
}

function goodOf(resource: PilferResource): Good | undefined {
    return Goods.find((good) => good === resource)
}

/** R-4.3.4 What this space's landscape holds; none without a landscape. */
function landscapeResource(
    state: HydratedFeudumGameState,
    space: SpaceState
): Landscape['resource'] | undefined {
    const { landscape } = space
    return landscape
        ? Landscapes.find((row) => row.kind === state.tileLandscapes[landscape.tileId])?.resource
        : undefined
}

/** R-3.7.4 A good on the space or a farm, or what its landscape holds. */
function reasonSourceRefused(
    state: HydratedFeudumGameState,
    playerId: string,
    space: SpaceState,
    { from, resource }: Pilfer
): string | undefined {
    if (from === 'landscape') {
        if (!space.landscape) {
            return 'There is no landscape there.'
        }
        if (space.serf?.playerId === playerId) {
            return "You can't pilfer from a landscape your own serf tends."
        }
        return landscapeResource(state, space) === resource && space.landscape.amount > 0
            ? undefined
            : `That landscape holds no ${resource}.`
    }
    const isFarm = space.location.kind === 'farm'
    if (from === 'farm' && !isFarm) {
        return 'There is no farm there.'
    }
    if (from === 'space' && isFarm) {
        return "That space's goods are its farm's harvest."
    }
    if (isFarm && space.ruler?.playerId === playerId) {
        return "You can't pilfer from a farm you rule."
    }
    const good = goodOf(resource)
    if (!good) {
        return `Only a landscape holds ${resource}.`
    }
    return space.goods[good] > 0 ? undefined : `There is no ${good} there.`
}

/** R-3.7.4, R-4.10.2 After all movement, one piece that moved takes from where it now stands. */
function reasonPilferRefused(
    state: HydratedFeudumGameState,
    playerId: string,
    pilfer: Pilfer,
    moved: readonly PieceRef[]
): string | undefined {
    const spaceId = moved.some((piece) => samePiece(piece, pilfer.piece))
        ? spaceOfPiece(state, pilfer.piece)
        : undefined
    if (!spaceId) {
        return 'Only a piece that moved can pilfer.'
    }
    const refused = reasonSourceRefused(state, playerId, state.spaces[spaceId], pilfer)
    if (refused || !pilfer.sulfurToBarrel) {
        return refused
    }
    return reasonSulfurToBarrelRefused(state, playerId, pilfer.resource)
}

/**
 * R-3.7.4, R-3.7-H2, R-4.3.4, R-4.10.2 The resource reaches the seat; a target as one of its
 * markers.
 */
function takePilfer(
    state: HydratedFeudumGameState,
    playerId: string,
    pilfer: Pilfer
): NonNullable<MoveMetadata['pilfer']> {
    const spaceId = spaceOfPiece(state, pilfer.piece)
    assertExists(spaceId, 'R-3.7.4 The piece that pilfers is on the board')
    const space = state.spaces[spaceId]
    const player = state.getPlayerState(playerId)
    const good = goodOf(pilfer.resource)
    if (pilfer.from === 'landscape') {
        assertExists(space.landscape, 'R-3.7.4 The landscape is there')
        space.landscape.amount -= 1
    } else if (good) {
        space.goods[good] -= 1
    }
    if (good) {
        if (pilfer.sulfurToBarrel) {
            player.barrel += 1
        } else {
            player.goods[good] += 1
        }
    } else if (pilfer.resource === 'shillings') {
        player.shillings += 1
    } else {
        return { spaceId, marker: targetToMarker(state, playerId) }
    }
    return { spaceId }
}

/** R-3.7.1, R-3.7.3, R-3.7.4 Every piece the input moves. */
function piecesMoved(playerId: string, { steps, godspeed }: MoveDraft): PieceRef[] {
    return [
        ...steps.map((step) => step.piece),
        ...(godspeed ? [godspeedAsStep(playerId, godspeed).piece] : [])
    ]
}

function trialOf(state: HydratedFeudumGameState): HydratedFeudumGameState {
    return new HydratedFeudumGameState(state.dehydrate())
}

/** R-3.7.3 One monk, by a step like any other, after the others. */
function reasonGodspeedRefused(
    state: HydratedFeudumGameState,
    playerId: string,
    godspeed: GodspeedStep
): string | undefined {
    const pawn = state.getPlayerState(playerId).pawns.find((own) => own.n === godspeed.pawn)
    return pawn?.character === 'monk'
        ? reasonStepRefused(state, playerId, godspeedAsStep(playerId, godspeed))
        : 'Godspeed moves only a monk.'
}

/** R-3.2, R-3.7.1, R-3.7.3 What a press needs before any step is judged. */
function reasonMovePressRefused(
    state: HydratedFeudumGameState,
    playerId: string,
    input: MoveInput
): string | undefined {
    const refused =
        reasonCardPlayRefused(state, playerId, 'move', input) ??
        (input.godspeed ? reasonSpecialRefused(state, playerId, 'move') : undefined)
    if (refused) {
        return refused
    }
    const allowance = moveAllowance(state, playerId)
    return input.steps.length > allowance ? `Your movement allowance is ${allowance}.` : undefined
}

/**
 * R-3.7.1, R-3.7.3, R-3.7.4, R-4.2 The steps fold in press order on this state, so each is judged
 * from where the last left the board: their records, or the first refusal.
 */
function foldMove(
    state: HydratedFeudumGameState,
    playerId: string,
    input: MoveInput
): MoveMetadata | string {
    const { godspeed, pilfer } = input
    const steps: MoveStepRecord[] = []
    for (const step of input.steps) {
        const reason = reasonStepRefused(state, playerId, step)
        if (reason) {
            return reason
        }
        steps.push(takeStep(state, playerId, step))
    }
    const godspeedReason = godspeed ? reasonGodspeedRefused(state, playerId, godspeed) : undefined
    if (godspeedReason) {
        return godspeedReason
    }
    const godspeedRecord = godspeed
        ? takeStep(state, playerId, godspeedAsStep(playerId, godspeed))
        : undefined
    const pilferReason = pilfer
        ? reasonPilferRefused(state, playerId, pilfer, piecesMoved(playerId, input))
        : undefined
    if (pilferReason) {
        return pilferReason
    }
    const pilferRecord = pilfer ? takePilfer(state, playerId, pilfer) : undefined
    const rankChanges = pilferRecord?.marker ? state.recomputeRanks(playerId) : []
    return {
        steps,
        ...(godspeedRecord ? { godspeed: godspeedRecord } : {}),
        ...(pilferRecord ? { pilfer: pilferRecord } : {}),
        ...(rankChanges.length > 0 ? { rankChanges } : {})
    }
}

/** R-3.7.1, R-3.7.3, R-3.7.4, R-4.2 A press judged on a copy, which leaves the table as it was. */
export function reasonMoveRefused(
    state: HydratedFeudumGameState,
    playerId: string,
    input: MoveInput
): string | undefined {
    const refused = reasonMovePressRefused(state, playerId, input)
    if (refused) {
        return refused
    }
    const fold = foldMove(trialOf(state), playerId, input)
    return typeof fold === 'string' ? fold : undefined
}

export interface MovePieceOffer {
    readonly piece: PieceRef
    /** R-4.2.4 */
    readonly pinned: boolean
    readonly ways: readonly RouteStep[]
}

export interface GodspeedOffer {
    readonly pawn: PawnState['n']
    readonly ways: readonly RouteStep[]
}

export interface PilferOffer {
    readonly piece: PieceRef
    readonly spaceId: SpaceId
    readonly from: PilferSource
    readonly resource: PilferResource
}

export interface MoveOffers {
    /** R-3.7.1 */
    readonly allowance: number
    readonly stepsLeft: number
    readonly pieces: readonly MovePieceOffer[]
    /** R-3.7.3 Empty without a Monk pawn on the board. */
    readonly godspeed: readonly GodspeedOffer[]
    /** R-3.7.4 */
    readonly pilfers: readonly PilferOffer[]
}

const PilferSources: readonly (readonly [PilferSource, readonly PilferResource[]])[] = [
    ['space', Goods],
    ['farm', Goods],
    ['landscape', [...new Set(Landscapes.map((landscape) => landscape.resource))]]
]

/** R-3.7.4 What each piece that moved may take where the draft left it. */
function pilferOffers(
    trial: HydratedFeudumGameState,
    playerId: string,
    moved: readonly PieceRef[]
): PilferOffer[] {
    const pieces = moved.filter(
        (piece, index) => moved.findIndex((other) => samePiece(other, piece)) === index
    )
    return pieces.flatMap((piece) => {
        const spaceId = spaceOfPiece(trial, piece)
        return !spaceId
            ? []
            : PilferSources.flatMap(([from, resources]) =>
                  resources.flatMap((resource): PilferOffer[] =>
                      reasonPilferRefused(trial, playerId, { piece, from, resource }, moved)
                          ? []
                          : [{ piece, spaceId, from, resource }]
                  )
              )
    })
}

/**
 * R-3.7.1, R-3.7.3, R-3.7.4, R-4.2 What the next press may be, once the draft's steps have folded
 * on a copy. The draft came from these offers, so its steps are legal.
 */
export function moveOffers(
    state: HydratedFeudumGameState,
    playerId: string,
    draft: MoveDraft = { steps: [] }
): MoveOffers {
    const trial = trialOf(state)
    for (const step of draft.steps) {
        takeStep(trial, playerId, step)
    }
    if (draft.godspeed) {
        takeStep(trial, playerId, godspeedAsStep(playerId, draft.godspeed))
    }
    const allowance = moveAllowance(trial, playerId)
    const stepsLeft = Math.max(0, allowance - draft.steps.length)
    const seatPawns = trial.getPlayerState(playerId).pawns.filter((pawn) => pawn.spaceId)
    const pawnOffers = seatPawns.map((pawn): MovePieceOffer => ({
        piece: { kind: 'pawn', playerId, n: pawn.n },
        pinned: isPinned(trial, playerId, pawn.n),
        ways: stepsLeft > 0 ? pawnSteps(trial, playerId, pawn.n) : []
    }))
    const monsterOffers = MonsterIds.filter(
        (monster) => trial.monsters[monster].playerId === playerId
    ).map((monster): MovePieceOffer => ({
        piece: { kind: 'monster', monsterId: monster },
        pinned: false,
        ways: stepsLeft > 0 ? monsterSteps(trial, monster) : []
    }))
    const godspeed = reasonSpecialRefused(trial, playerId, 'move')
        ? []
        : seatPawns
              .filter((pawn) => pawn.character === 'monk')
              .map((pawn): GodspeedOffer => ({
                  pawn: pawn.n,
                  ways: pawnSteps(trial, playerId, pawn.n)
              }))
    return {
        allowance,
        stepsLeft,
        pieces: [...pawnOffers, ...monsterOffers],
        godspeed,
        pilfers: pilferOffers(trial, playerId, piecesMoved(playerId, draft))
    }
}

export class HydratedMove extends HydratableAction<typeof Move> implements Move {
    declare type: ActionType.Move
    declare playerId: string
    declare steps: MoveStep[]
    declare godspeed?: GodspeedStep
    declare pilfer?: Pilfer
    declare metadata?: MoveMetadata
    declare asRepeat?: RepeatMode
    declare secondCard?: true

    constructor(data: Move) {
        super(data, MoveValidator)
    }

    /** R-3.7, R-3.7.2, R-3.7.3, R-3.7.4, R-3.7.5 Not a barrier: everything it touches is public. */
    apply(state: HydratedFeudumGameState, _context?: MachineContext) {
        const { playerId, godspeed } = this
        const refused = reasonMovePressRefused(state, playerId, this)
        if (refused) {
            throw Error(refused)
        }
        // No copy: a copy reads the protected cursor, and a card from the hand runs in its own view.
        const metadata = foldMove(state, playerId, this)
        if (typeof metadata === 'string') {
            throw Error(metadata)
        }
        playCard(state, playerId, 'move', godspeed ? 'special' : 'regular', this)
        // R-3.7-H3 A Move with no step and no Godspeed is a legal play, not a successful move.
        if (metadata.steps.length > 0 || metadata.godspeed) {
            const player = state.getPlayerState(playerId)
            player.successfulMoves += 1
            if (player.successfulMoves === SuccessfulMovesForVoyage) {
                queueFollowUp(state, { kind: 'voyage', playerId })
            }
        }
        this.metadata = metadata
    }
}
