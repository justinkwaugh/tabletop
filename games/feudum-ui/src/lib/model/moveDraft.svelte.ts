import { assertExists } from '@tabletop/common'
import type { StagedSelectionState } from '@tabletop/frontend-components'
import {
    FerryFare,
    Move,
    moveOffers,
    reasonMoveRefused,
    type CardPlayInput,
    type GodspeedStep,
    type HydratedFeudumGameState,
    type MoveInput,
    type MoveOffers,
    type MovePieceOffer,
    type MoveStep,
    type PawnNumber,
    type PieceRef,
    type Pilfer,
    type PilferOffer,
    type PilferResource,
    type RouteStep,
    type SpaceId
} from '@tabletop/feudum'
import {
    pieceTarget,
    pilferTarget,
    spaceTarget,
    type BoardTarget,
    type ChipNote,
    type PickTarget,
    type StagePick,
    type TrailStep
} from './boardOffer.js'
import {
    spaceLabel,
    type FlowPick,
    type FlowPlay,
    type FlowPopup,
    type PanelChoice
} from './cardFlows.js'
import { primaryLabel } from './confirmingSend.js'
import { StagedDraft, withLoneChoice } from './stagedDraft.svelte.js'
import type { TurnPrimary } from './turnDraft.svelte.js'

export type MoveDraftValues = {
    /** R-3.7.1 Stacked: each press is one step, in press order. */
    steps: readonly MoveStep[]
    /** The piece a space press moves; absent, the one that last stepped; 'none', unpicked. */
    piece: PieceRef | 'none'
    /** A space several ways reach: its popup is open. */
    to: SpaceId
    /** R-3.7.1 The steps ended early, by the seat. */
    stopped: true
    /** The same popup, once the steps have ended and only Godspeed is left. */
    godspeedTo: SpaceId
    godspeed: GodspeedStep | 'none'
    /** R-3.7.4 */
    pilfer: Pilfer | 'none'
    /** R-4.10.2 A pilfered sulfur goes to the barrel. */
    barrel: boolean
}

export const MoveStageOrder = [
    'steps',
    'piece',
    'to',
    'stopped',
    'godspeedTo',
    'godspeed',
    'pilfer',
    'barrel'
] as const satisfies readonly (keyof MoveDraftValues)[]
type MissingStages = Exclude<keyof MoveDraftValues, (typeof MoveStageOrder)[number]>
const stageCoverage: MissingStages extends never ? true : never = true
void stageCoverage

/** Where the card's flow has got to; `send` has nothing left to choose. */
export type MoveStageName = 'steps' | 'godspeed' | 'pilfer' | 'send'

/** Present only while this seat's card is a Move: R-X.1. */
export interface MoveContext {
    readonly state: HydratedFeudumGameState
    readonly playerId: string
    /** R-3.3, R-3.15 What the card's play declares. */
    readonly input: CardPlayInput
}

export interface MovePanel {
    /** R-3.7.1 "3 of 4 steps left" */
    readonly line: string
    readonly stage: MoveStageName
    /** Empty while a popup waits for its answer. */
    readonly rows: readonly PanelChoice[]
    readonly popup?: FlowPopup
    readonly primary?: TurnPrimary
}

interface MoveView {
    readonly stage: MoveStageName
    readonly picks: readonly FlowPick[]
    readonly unlit: readonly PickTarget[]
    readonly picked: readonly BoardTarget[]
    readonly rows: readonly PanelChoice[]
    readonly popup?: FlowPopup
}

/** R-4.2 A step's medium in words. */
function words(id: string): string {
    return id.replaceAll('-', ' ')
}

function titled(line: string): string {
    return `${line.charAt(0).toUpperCase()}${line.slice(1)}`
}

/** R-4.2, R-4.2.2, R-4.2.3 What one way says on its space and in its popup row. */
function wayNote(way: RouteStep): ChipNote {
    const medium = words(way.route.medium)
    if (way.ferry) {
        return { kind: 'cost', label: `${medium} · ${FerryFare}s` }
    }
    if (way.vessel === 'place') {
        return { kind: 'role', label: `place your ${medium}` }
    }
    return { kind: 'role', label: way.vessel === 'board' ? `board the ${medium}` : medium }
}

/** R-3.7.3 What a Godspeed destination says on its space; a ferry's fare keeps its rose chip. */
function godspeedNote(way: RouteStep): ChipNote {
    return way.ferry
        ? { kind: 'cost', label: `Godspeed · ${wayNote(way).label}` }
        : { kind: 'role', label: 'Godspeed' }
}

/**
 * R-3.7.1, R-3.7.3 One press a lit space can stand for: a step of the picked piece, or a monk's
 * Godspeed step from where it now stands. The logic folds Godspeed after the steps, so taking it
 * while steps remain is stopping there.
 */
export type SpaceMove =
    | { readonly kind: 'step'; readonly piece: PieceRef; readonly way: RouteStep }
    | {
          readonly kind: 'godspeed'
          readonly pawn: PawnNumber
          readonly from: SpaceId
          readonly way: RouteStep
      }

function sameMover(a: SpaceMove, b: SpaceMove): boolean {
    return a.kind === 'step' ? b.kind === 'step' : b.kind === 'godspeed' && a.pawn === b.pawn
}

/**
 * The popup's rows for the moves to one space; only a cost keeps its chip. A row names what
 * happens only when the space mixes a step with a Godspeed, or two monks, and its way only when
 * its mover has several.
 */
export function moveChoices(
    moves: readonly SpaceMove[],
    take: (move: SpaceMove) => void
): readonly PanelChoice[] {
    const monks = new Set(moves.flatMap((move) => (move.kind === 'godspeed' ? [move.pawn] : [])))
    const mixed = monks.size > 1 || (monks.size > 0 && moves.some(({ kind }) => kind === 'step'))
    return moves.map((move): PanelChoice => {
        const note = wayNote(move.way)
        const what = move.kind === 'step' ? 'Step' : `Godspeed: monk from ${spaceLabel(move.from)}`
        const ways = moves.filter((other) => sameMover(other, move)).length
        return {
            label: !mixed ? titled(note.label) : ways > 1 ? `${what} · ${note.label}` : what,
            ...(note.kind === 'cost' ? { note } : {}),
            picked: false,
            press: () => {
                take(move)
            }
        }
    })
}

/** R-3.7.1, R-4.2 A way as the logic's step names it. */
function wayOfStep({ to, route, vessel, ferry }: RouteStep): Omit<GodspeedStep, 'pawn'> {
    return {
        to,
        medium: route.medium,
        ...(vessel ? { vessel } : {}),
        ...(ferry ? { ferry } : {})
    }
}

function sameWay(a: RouteStep, b: RouteStep): boolean {
    return a.to === b.to && a.route === b.route && a.vessel === b.vessel && a.ferry === b.ferry
}

/**
 * R-3.7.3 Godspeed's ways are the monk's own steps, so while steps remain a Godspeed way the
 * monk's step offers is that step: taking it as Godspeed would only give up the steps left.
 */
function godspeedBeyondSteps(offers: MoveOffers): MoveOffers['godspeed'] {
    return offers.godspeed.map(({ pawn, ways }) => {
        const steps =
            offers.pieces.find(({ piece }) => piece.kind === 'pawn' && piece.n === pawn)?.ways ?? []
        return { pawn, ways: ways.filter((way) => !steps.some((step) => sameWay(step, way))) }
    })
}

/** The moves to each space, spaces and moves in the order given. */
function movesBySpace(moves: readonly SpaceMove[]): ReadonlyMap<SpaceId, readonly SpaceMove[]> {
    const spaces = new Map<SpaceId, SpaceMove[]>()
    for (const move of moves) {
        spaces.set(move.way.to, [...(spaces.get(move.way.to) ?? []), move])
    }
    return spaces
}

function placeOf(state: HydratedFeudumGameState, piece: PieceRef): SpaceId | undefined {
    return piece.kind === 'pawn'
        ? state.getPlayerState(piece.playerId).pawns.find(({ n }) => n === piece.n)?.spaceId
        : state.monsters[piece.monsterId].spaceId
}

function samePiece(a: PieceRef, b: PieceRef): boolean {
    return pieceTarget(a) === pieceTarget(b)
}

function pilferKey({ spaceId, from, resource }: PilferOffer): BoardTarget {
    return pilferTarget(spaceId, from, resource)
}

const PilferWord: Partial<Record<PilferResource, string>> = {
    shillings: 'shilling',
    targets: 'target'
}

function pilferWord(resource: PilferResource): string {
    return PilferWord[resource] ?? resource
}

/**
 * R-3.7 The Move draft (contract: Shared visual state): stacked steps, then the Godspeed step, then
 * the pilfer. The rules stay in `moveOffers` and `reasonMoveRefused`; this says which stage is open
 * and what each press stages. A Move always sends on the primary: nothing here completes on a press.
 */
export class MoveDraft extends StagedDraft<MoveDraftValues> {
    private readonly seeing: StagedSelectionState<MoveDraftValues> = $derived.by(() =>
        this.withLoneChoices(super.read())
    )

    constructor(private readonly contextOf: () => MoveContext | undefined) {
        super(MoveStageOrder)
    }

    /** R-X.1 Others and History View have no draft; a lone piece reads through as `auto`. */
    protected override read(): StagedSelectionState<MoveDraftValues> {
        return this.seeing
    }

    private withLoneChoices(
        stored: StagedSelectionState<MoveDraftValues>
    ): StagedSelectionState<MoveDraftValues> {
        const context = this.contextOf()
        if (!context) {
            return {}
        }
        const steps = stored.steps?.value ?? []
        const { pieces } = moveOffers(context.state, context.playerId, { steps })
        return withLoneChoice<MoveDraftValues, 'piece'>(
            stored,
            MoveStageOrder,
            'piece',
            pieces.filter(({ ways }) => ways.length > 0).map(({ piece }) => piece)
        )
    }

    private get steps(): readonly MoveStep[] {
        return this.value('steps') ?? []
    }

    private get godspeed(): GodspeedStep | undefined {
        const godspeed = this.value('godspeed')
        return godspeed === 'none' ? undefined : godspeed
    }

    private offers: MoveOffers | undefined = $derived.by(() => {
        const context = this.contextOf()
        const { steps, godspeed } = this
        return (
            context &&
            moveOffers(context.state, context.playerId, {
                steps,
                ...(godspeed ? { godspeed } : {})
            })
        )
    })

    /** The piece a space press moves: the one pressed, or else the one that last stepped. */
    private pickedPiece(movable: readonly MovePieceOffer[]): MovePieceOffer | undefined {
        const staged = this.value('piece')
        const piece = staged === 'none' ? undefined : (staged ?? this.steps.at(-1)?.piece)
        return piece && movable.find((offer) => samePiece(offer.piece, piece))
    }

    /** Contract, Pick conventions: pressing a pick again unpicks it, whichever way it was picked. */
    private pressPiece(piece: PieceRef, picked: boolean): void {
        if (!picked) {
            this.set('piece', piece)
        } else if (this.entry('piece')?.source === 'manual') {
            this.clearFrom('piece')
        } else {
            this.set('piece', 'none')
        }
    }

    private takeStep(piece: PieceRef, way: RouteStep): void {
        this.push('steps', [...this.steps, { piece, ...wayOfStep(way) }])
    }

    /** R-3.7.3 Godspeed is the Move's last step: staging it ends the steps. */
    private takeMove(move: SpaceMove): void {
        if (move.kind === 'step') {
            this.takeStep(move.piece, move.way)
        } else {
            this.set('godspeed', { pawn: move.pawn, ...wayOfStep(move.way) })
        }
    }

    /** R-3.7.3 Each monk's Godspeed steps, from where the draft's steps have left it. */
    private godspeedMoves(context: MoveContext, monks: MoveOffers['godspeed']): SpaceMove[] {
        return monks.flatMap(({ pawn, ways }) => {
            const piece: PieceRef = { kind: 'pawn', playerId: context.playerId, n: pawn }
            const from =
                this.steps.findLast((step) => samePiece(step.piece, piece))?.to ??
                placeOf(context.state, piece)
            assertExists(from, `R-3.7.3 Monk ${pawn} stands on the board`)
            return ways.map((way): SpaceMove => ({ kind: 'godspeed', pawn, from, way }))
        })
    }

    /** One move to a space goes at once; several ask (contract: Popups). */
    private spacePicks(
        moves: readonly SpaceMove[],
        ask: (spaceId: SpaceId) => void
    ): readonly FlowPick[] {
        return [...movesBySpace(moves)].map(([spaceId, toSpace]): FlowPick => ({
            target: spaceTarget(spaceId),
            notes: [
                ...toSpace.flatMap((move) =>
                    move.kind === 'godspeed' ? [godspeedNote(move.way)] : []
                ),
                ...toSpace.flatMap((move) => (move.kind === 'step' ? [wayNote(move.way)] : []))
            ],
            press: () => {
                const [only] = toSpace
                if (toSpace.length === 1 && only) {
                    this.takeMove(only)
                } else {
                    ask(spaceId)
                }
            }
        }))
    }

    private popupFor(
        spaceId: SpaceId | undefined,
        moves: readonly SpaceMove[]
    ): FlowPopup | undefined {
        const toSpace = moves.filter(({ way }) => way.to === spaceId)
        return spaceId && toSpace.length > 1
            ? {
                  anchor: spaceTarget(spaceId),
                  choices: moveChoices(toSpace, (move) => {
                      this.takeMove(move)
                  })
              }
            : undefined
    }

    /**
     * Contract, Hover: what staging a Move would light: its pieces and a lone piece's ways, or the
     * Godspeed destinations when no piece can step.
     */
    lightsOpening(context: MoveContext): readonly BoardTarget[] {
        const offers = moveOffers(context.state, context.playerId, { steps: [] })
        const movable = offers.pieces.filter(({ ways }) => ways.length > 0)
        const [lone] = movable
        const monks = movable.length > 0 ? godspeedBeyondSteps(offers) : offers.godspeed
        const ways = [
            ...(movable.length === 1 ? lone.ways : []),
            ...monks.flatMap((monk) => monk.ways)
        ]
        return [
            ...movable.map(({ piece }) => pieceTarget(piece)),
            ...[...new Set(ways.map(({ to }) => to))].map((spaceId) => spaceTarget(spaceId))
        ]
    }

    /**
     * R-3.7.1 Steps until the allowance is spent or the seat stops; S30 takes no press. R-3.7.3 A
     * Godspeed way that is no step lights alongside: taking it stops the steps there.
     */
    private stepsView(
        context: MoveContext,
        offers: MoveOffers,
        unlit: readonly PickTarget[]
    ): MoveView {
        const movable = offers.pieces.filter(({ ways }) => ways.length > 0)
        const picked = this.pickedPiece(movable)
        const moves: SpaceMove[] = [
            ...(picked
                ? picked.ways.map((way): SpaceMove => ({ kind: 'step', piece: picked.piece, way }))
                : []),
            ...this.godspeedMoves(context, godspeedBeyondSteps(offers))
        ]
        const pieces = movable.map(({ piece }): FlowPick => {
            const isPicked = picked !== undefined && samePiece(picked.piece, piece)
            return {
                target: pieceTarget(piece),
                press: () => {
                    this.pressPiece(piece, isPicked)
                }
            }
        })
        const popup = this.popupFor(this.value('to'), moves)
        return {
            stage: 'steps',
            picks: [
                ...pieces,
                ...this.spacePicks(moves, (spaceId) => {
                    this.set('to', spaceId)
                })
            ],
            unlit,
            picked: picked ? [pieceTarget(picked.piece)] : [],
            rows: [
                {
                    label: 'Stop moving',
                    shown: 'Done',
                    picked: false,
                    press: () => {
                        this.set('stopped', true)
                    }
                }
            ],
            ...(popup ? { popup } : {})
        }
    }

    /** R-3.7.3 Once the steps have ended: each monk's next spaces light at once, or none. */
    private godspeedView(moves: readonly SpaceMove[], unlit: readonly PickTarget[]): MoveView {
        const popup = this.popupFor(this.value('godspeedTo'), moves)
        return {
            stage: 'godspeed',
            picks: this.spacePicks(moves, (spaceId) => {
                this.set('godspeedTo', spaceId)
            }),
            unlit,
            picked: [],
            rows: [
                {
                    label: 'No Godspeed',
                    picked: false,
                    press: () => {
                        this.set('godspeed', 'none')
                    }
                }
            ],
            ...(popup ? { popup } : {})
        }
    }

    private isPicked(offer: PilferOffer): boolean {
        const pilfer = this.value('pilfer')
        return (
            pilfer !== undefined &&
            pilfer !== 'none' &&
            samePiece(pilfer.piece, offer.piece) &&
            pilfer.from === offer.from &&
            pilfer.resource === offer.resource
        )
    }

    /** R-4.10.2 The logic says whether this pilfer could go to the barrel; the seat says if it does. */
    private barrelPopup(
        context: MoveContext,
        offers: readonly PilferOffer[]
    ): FlowPopup | undefined {
        const pilfer = this.value('pilfer')
        const offer = offers.find((row) => this.isPicked(row))
        if (
            !offer ||
            pilfer === undefined ||
            pilfer === 'none' ||
            this.value('barrel') !== undefined ||
            reasonMoveRefused(context.state, context.playerId, {
                ...this.inputOf(context),
                pilfer: { ...pilfer, sulfurToBarrel: true }
            })
        ) {
            return undefined
        }
        const choice = (label: string, barrel: boolean): PanelChoice => ({
            label,
            picked: false,
            press: () => {
                this.set('barrel', barrel)
            }
        })
        return {
            anchor: pilferKey(offer),
            choices: [choice('Keep it', false), choice('Into the barrel', true)]
        }
    }

    /** R-3.7.4 One resource where a piece that moved now stands, or none. */
    private pilferView(context: MoveContext, offers: readonly PilferOffer[]): MoveView {
        const once = [...new Map(offers.map((offer) => [pilferKey(offer), offer])).values()]
        const popup = this.barrelPopup(context, offers)
        const staged = this.value('pilfer')
        return {
            stage: 'pilfer',
            picks: once.map((offer): FlowPick => ({
                target: pilferKey(offer),
                notes: [{ kind: 'gain', label: pilferWord(offer.resource) }],
                press: () => {
                    if (this.isPicked(offer)) {
                        this.clearFrom('pilfer')
                    } else {
                        const { piece, from, resource } = offer
                        this.set('pilfer', { piece, from, resource })
                    }
                }
            })),
            unlit: [],
            picked: once.filter((offer) => this.isPicked(offer)).map(pilferKey),
            rows: [
                {
                    label: 'No pilfer',
                    picked: staged === 'none',
                    press: () => {
                        if (staged === 'none') {
                            this.clearFrom('pilfer')
                        } else {
                            this.set('pilfer', 'none')
                        }
                    }
                }
            ],
            ...(popup ? { popup } : {})
        }
    }

    private view: MoveView | undefined = $derived.by(() => {
        const context = this.contextOf()
        const { offers } = this
        if (!context || !offers) {
            return undefined
        }
        const unlit = offers.pieces
            .filter(({ pinned }) => pinned)
            .map(({ piece }): PickTarget => ({
                target: pieceTarget(piece),
                notes: [{ kind: 'threat', label: 'pinned' }],
                unlit: true
            }))
        const godspeed = this.value('godspeed')
        if (
            !this.value('stopped') &&
            !godspeed &&
            offers.pieces.some(({ ways }) => ways.length > 0)
        ) {
            return this.stepsView(context, offers, unlit)
        }
        const monks = this.godspeedMoves(context, offers.godspeed)
        if (!godspeed && monks.length > 0) {
            return this.godspeedView(monks, unlit)
        }
        return offers.pilfers.length > 0
            ? this.pilferView(context, offers.pilfers)
            : { stage: 'send', picks: [], unlit: [], picked: [], rows: [] }
    })

    private inputOf(context: MoveContext): MoveInput {
        const { godspeed } = this
        return {
            ...context.input,
            steps: [...this.steps],
            ...(godspeed ? { godspeed } : {})
        }
    }

    /** Every stage has its answer: only the primary is left. */
    private answered: boolean = $derived.by(() => {
        const { view } = this
        return (
            view !== undefined &&
            !view.popup &&
            (view.stage === 'send' || (view.stage === 'pilfer' && !!this.value('pilfer')))
        )
    })

    /** What the primary sends, once the logic's refusal has passed. */
    play: FlowPlay | undefined = $derived.by(() => {
        const context = this.contextOf()
        if (!context || !this.answered) {
            return undefined
        }
        const pilfer = this.value('pilfer')
        const input: MoveInput = {
            ...this.inputOf(context),
            ...(pilfer && pilfer !== 'none'
                ? {
                      pilfer: {
                          ...pilfer,
                          ...(this.value('barrel') ? { sulfurToBarrel: true as const } : {})
                      }
                  }
                : {})
        }
        return reasonMoveRefused(context.state, context.playerId, input)
            ? undefined
            : {
                  build: (maker) =>
                      maker.createPlayerAction(Move, {
                          ...input,
                          steps: [...input.steps]
                      })
              }
    })

    /** R-3.7.3 Godspeed counts among the primary's steps, not against the allowance. */
    private primaryName(): string {
        const count = this.steps.length + (this.godspeed ? 1 : 0)
        const steps = `Move · ${count} ${count === 1 ? 'step' : 'steps'}`
        const pilfer = this.value('pilfer')
        return pilfer && pilfer !== 'none'
            ? `${steps} · pilfer 1 ${pilferWord(pilfer.resource)}`
            : steps
    }

    panel: MovePanel | undefined = $derived.by(() => {
        const { view, offers, play } = this
        if (!view || !offers) {
            return undefined
        }
        return {
            line: `${offers.stepsLeft} of ${offers.allowance} steps left`,
            stage: view.stage,
            rows: view.popup ? [] : view.rows,
            ...(view.popup ? { popup: view.popup } : {}),
            ...(this.answered
                ? {
                      primary: {
                          label: primaryLabel(this.primaryName(), play),
                          enabled: play !== undefined
                      }
                  }
                : {})
        }
    })

    /** R-3.7.1, R-3.7.3 The steps taken, each from where the last left its piece. */
    private trail(state: HydratedFeudumGameState, playerId: string): readonly TrailStep[] {
        const at = new Map<BoardTarget, SpaceId | undefined>()
        const walk = (piece: PieceRef, to: SpaceId) => {
            const target = pieceTarget(piece)
            const from = at.has(target) ? at.get(target) : placeOf(state, piece)
            at.set(target, to)
            return from
        }
        const { godspeed, steps } = this
        const moved = [
            ...steps,
            ...(godspeed
                ? [
                      {
                          ...godspeed,
                          piece: { kind: 'pawn', playerId, n: godspeed.pawn } satisfies PieceRef
                      }
                  ]
                : [])
        ]
        return moved.flatMap(({ piece, to, medium }, index): TrailStep[] => {
            const from = walk(piece, to)
            return from
                ? [
                      {
                          n: index + 1,
                          piece,
                          from,
                          to,
                          medium,
                          ...(index >= steps.length ? { godspeed: true } : {})
                      }
                  ]
                : []
        })
    }

    /** What the board lights; only the seat whose card it is has one. */
    pick: StagePick | undefined = $derived.by(() => {
        const context = this.contextOf()
        const { view } = this
        return context && view
            ? {
                  targets: [
                      ...view.picks.map(({ target, notes }): PickTarget => ({
                          target,
                          ...(notes ? { notes } : {})
                      })),
                      ...view.unlit
                  ],
                  picked: view.picked,
                  trail: this.trail(context.state, context.playerId)
              }
            : undefined
    })

    /** A press outside an open popup does nothing (contract: Coexistence and precedence). */
    pickOf(target: BoardTarget): FlowPick | undefined {
        const { view } = this
        return view?.popup ? undefined : view?.picks.find((pick) => pick.target === target)
    }
}
