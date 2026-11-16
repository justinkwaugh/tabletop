import {
    ActionCardKinds,
    ActionCards,
    StartingSpaceIds,
    type ActionCardKind,
    type Character,
    type Good,
    type PawnNumber,
    type PouchGood,
    type WritId
} from '@tabletop/feudum'
import type { BenchOffer } from './benchOffer.js'
import { benchViewOf, stagedMoves, type GhostPiece } from './benchView.js'
import { spaceTarget, type BoardTarget } from './boardOffer.js'
import type { DiscArt, PanelChoice, TallyLine } from './cardFlows.js'
import type { DraftArt, DraftChoice } from './deciderDraft.svelte.js'
import type { GameEndSummaryView } from './gameEnd.js'
import type { DawnSheetView } from './roundEnd.js'
import { rankedDie, type DieArt } from './guildDie.js'
import type { Feed, NourishSend, NourishSummary } from './nourishDraft.svelte.js'
import type { SeatPaint } from './seatPaint.js'
import { takesTradePicker } from './tradePicker.js'
import type { FeudumGameSession } from './session.svelte.js'
import type { SulfurDestination } from './startingGoodsDraft.svelte.js'
import type { OrderRow } from './sharedRows.js'
import type { TileArt } from './tileName.js'
import type { TurnPrimary } from './turnDraft.svelte.js'
import { waitingWords } from './watching.js'
import { writName } from './writLabels.js'

export type RowArt =
    | { readonly kind: 'good'; readonly good: Good }
    | { readonly kind: 'pawn'; readonly character?: Character; readonly paint: SeatPaint }
    | TileArt
    | DieArt
    | DiscArt
    | DraftArt

export interface ActionRow {
    readonly choice: PanelChoice
    readonly press: () => void | Promise<void>
    readonly art?: RowArt
    /** R-3.3 A pouch choice: what it does, beneath its name. */
    readonly caption?: string
    /** R-3.2 Forfeit: a choice that stands last, drawn quieter than the modes before it. */
    readonly quiet?: true
    /** A card's mode: refused, it shows its reason beneath its name before any press. */
    readonly explained?: true
}

/** R-4.10.1 One feed of one pawn, as the nourish picker draws it: its words, and beneath them its caption. */
export type NourishOptionRow = ActionRow & {
    readonly feed: Feed
    readonly caption: string
    readonly spent: boolean
}

/** R-4.10.1 One pawn the picker feeds: its cube, its name and place, and its feeds. */
export interface NourishPickerPawn {
    readonly n: PawnNumber
    readonly character: Character
    readonly name: string
    readonly place: string
    readonly paint: SeatPaint
    readonly unfed: boolean
    readonly options: readonly NourishOptionRow[]
}

/** R-4.6 One staged move in the tray: its piece, its words, and the press that takes it back. */
export interface StagedLine {
    readonly item: string
    readonly piece?: GhostPiece
    /** A Knight row's marker: its row's paint. */
    readonly paint?: SeatPaint
    readonly text: string
    readonly words: string
    readonly takeBack: ActionRow
}

export interface CardRow {
    readonly kind: ActionCardKind
    /** The printed name: a row is found by it. */
    readonly label: string
    readonly number: number
    readonly picked: boolean
    /** R-3.1 The slot of the plan a drafted card fills, from 1. */
    readonly slot?: number
    readonly lights?: () => readonly BoardTarget[]
    readonly press: () => void | Promise<void>
}

/** R-3.1 One slot of the plan: its number, and the card in it, whose press takes it back. */
export interface PlanSlot {
    readonly at: number
    readonly card?: CardRow
}

export interface WritRow {
    readonly writId: WritId
    readonly choice: PanelChoice
    readonly press: () => void | Promise<void>
}

export interface FinaliseEntry {
    readonly playerId: string
    readonly name: string
    readonly paint: SeatPaint
    readonly finalised: boolean
    /** The seat looking: its chip reads "(you)". */
    readonly you: boolean
    /** S8 A seat still choosing while the one looking, its hand set, waits on it. */
    readonly awaited: boolean
}

/** A writ's face with what it offers beneath it: a mandate's alternatives, a charter's seal. */
export interface WritOffer {
    readonly writId: WritId
    readonly name: string
    readonly rows: readonly ActionRow[]
}

/** A seat as its chip: its colour and its name. */
export interface WaitingSeat {
    readonly playerId: string
    readonly name: string
    readonly paint: SeatPaint
}

export interface SeatNames {
    readonly nameOf: (playerId: string) => string
    readonly paintOf: (playerId: string) => SeatPaint
}

export type LineRole =
    'turn' | 'flow' | 'count' | 'warning' | 'note' | 'waiting' | 'previous' | 'refusal'

/**
 * Where a block stands when it is not in the panel's own run: in the tray beside the picked card
 * (R-3.2, its modes and send), at the end of the hand's line (the at-will chips), or beside the
 * eleven of a hand draft (R-3.1: the finalise row, the plan, the pouch and the send).
 */
export type BlockPlace = 'tray' | 'hand-end' | 'draft'

export type ActionBlock = PanelBlock & { readonly stands?: BlockPlace }

type PanelBlock =
    | {
          readonly kind: 'finalise'
          readonly entries: readonly FinaliseEntry[]
          /** R-3.1-H1 "everyone at once · pouch goods shown when all have finalised" */
          readonly caption: string
          /** "Round 4 · choose your hand", while this seat drafts. */
          readonly lead?: string
      }
    /** R-3.1-H1 Tray A once this seat has finalised: the hand as set, and the pouch sealed. */
    | {
          readonly kind: 'hand-set'
          readonly paint: SeatPaint
          readonly cards: readonly {
              readonly kind: ActionCardKind
              readonly number: number
              readonly label: string
          }[]
          readonly pouch?: { readonly good: PouchGood; readonly title: string }
      }
    /** R-3.1 The plan: a slot per card the hand needs, filled in the order pressed. */
    | {
          readonly kind: 'slots'
          readonly paint: SeatPaint
          readonly slots: readonly PlanSlot[]
          readonly caption: string
      }
    | {
          readonly kind: 'line'
          readonly role: LineRole
          readonly text: string
          /** R-X.1 A waiting line's seats, each drawn as its chip: "Waiting on <chip>." */
          readonly on?: readonly WaitingSeat[]
          readonly lead?: string
          /** A phone's wording, after the card's name, where the tray has room for one line. */
          readonly short?: string
      }
    | {
          readonly kind: 'goods-counts'
          readonly counts: readonly { readonly good: Good; readonly count: number }[]
      }
    | {
          readonly kind: 'cards'
          readonly tone: 'draft' | 'hand'
          readonly paint: SeatPaint
          readonly rows: readonly CardRow[]
      }
    | { readonly kind: 'writs'; readonly rows: readonly WritRow[] }
    | { readonly kind: 'writ-offers'; readonly offers: readonly WritOffer[] }
    /** R-4.4.1 How many writs the drawer holds face down: others see backs, and nothing more. */
    | { readonly kind: 'backs'; readonly count: number }
    | (OrderRow & {
          readonly kind: 'order-row'
          readonly seats: SeatNames
          /** The viewer: a phone's row says "you" on that seat while it decides. */
          readonly me?: string
      })
    | {
          readonly kind: 'dawn-sheet'
          readonly sheet: DawnSheetView
          readonly seats: SeatNames
      }
    | {
          readonly kind: 'game-end'
          readonly summary: GameEndSummaryView
          readonly seats: SeatNames
      }
    | {
          readonly kind: 'rows'
          readonly name: string
          /** A small heading before the rows: the attack's saltpeter count, a landscape's place. */
          readonly heading?: string
          /** Beneath the heading, where it has one: the pouch's "one or none". */
          readonly hint?: string
          /** It stands on a line of its own: the starting sulfur's destination. */
          readonly line?: true
          readonly rows: readonly ActionRow[]
      }
    | {
          readonly kind: 'tally'
          readonly lines: readonly TallyLine[]
          readonly note?: string
      }
    /** R-4.6 What a push or a pull has staged on the bench, listed in the tray. */
    | {
          readonly kind: 'staged'
          readonly lines: readonly StagedLine[]
          readonly tally?: string
      }
    | PrimaryBlock
    /**
     * Contract, The trade picker: a guild's trade read as choice cards, in the tray on a desk and in
     * the bench's sheet on a phone, holding the send. The card's modes stand in the tray's control
     * row above it.
     */
    | {
          readonly kind: 'trade-picker'
          readonly bench: BenchOffer
          readonly send?: PrimaryBlock
      }
    /**
     * Contract, Round end: the nourish picker. A row per pawn, and beside the rows a summary of what
     * is paid and kept, the unfed rule, and the send; R-4.3.3 a tile's rows when one could feed.
     */
    | {
          readonly kind: 'nourish-picker'
          readonly pawns: readonly NourishPickerPawn[]
          readonly summary: NourishSummary
          readonly rule: string
          readonly covers?: { readonly line: string; readonly rows: readonly ActionRow[] }
          readonly send: PrimaryBlock & { readonly tally: NourishSend }
      }

interface PrimaryBlock {
    readonly kind: 'primary'
    readonly label: string
    /** A second line under the label. */
    readonly note?: string
    readonly enabled: boolean
    readonly send: () => void | Promise<void>
}

export interface ActionPanelView {
    readonly blocks: readonly ActionBlock[]
}

/** What the panel reads of a session; it restates no rule of its own. */
export type PanelSession = Pick<
    FeudumGameSession,
    | 'paintOf'
    | 'colourPaintOf'
    | 'gameState'
    | 'startingGoodsPanel'
    | 'startingPawnPanel'
    | 'handPanel'
    | 'keepWritsPanel'
    | 'favoursPanel'
    | 'answerAttackPanel'
    | 'answerStarvePanel'
    | 'commitPanel'
    | 'writLimitPanel'
    | 'nourishPanel'
    | 'landscapesPanel'
    | 'atWillPanel'
    | 'offTurnDiscardPanel'
    | 'discPanel'
    | 'orderRow'
    | 'combatTally'
    | 'roundEnd'
    | 'gameEnd'
    | 'turnPanel'
    | 'movePanel'
    | 'guildPanel'
    | 'watchingPanel'
    | 'previousSeatLine'
    | 'myPlayerId'
    | 'getPlayerName'
    | 'pressStartingGood'
    | 'chooseSulfurDestination'
    | 'sendStartingGoods'
    | 'pressStartingCharacter'
    | 'toggleHandCard'
    | 'choosePouch'
    | 'finaliseHand'
    | 'pressTurnCard'
    | 'pressTurnChoice'
    | 'toggleTurnSecondCard'
    | 'forfeitTurnCard'
    | 'sendTurnCard'
    | 'pressDraftChoice'
    | 'sendFollowUp'
    | 'keepThenShovels'
    | 'chooseNoFavours'
    | 'answerAttack'
    | 'answerStarveWith'
>

function titled(word: string): string {
    return `${word.charAt(0).toUpperCase()}${word.slice(1)}`
}

function cardFace(kind: ActionCardKind): { readonly number: number; readonly label: string } {
    return {
        number: ActionCardKinds.indexOf(kind) + 1,
        label: ActionCards.find((card) => card.kind === kind)?.printedName ?? kind
    }
}

function plainChoice(label: string, picked: boolean, refusal?: string): PanelChoice {
    return { label, picked, ...(refusal ? { refusal } : {}) }
}

function primaryBlock(
    primary: TurnPrimary & { readonly note?: string },
    send: () => void | Promise<void>
): PrimaryBlock {
    return {
        kind: 'primary',
        label: primary.label,
        ...(primary.note ? { note: primary.note } : {}),
        enabled: primary.enabled,
        send
    }
}

function line(role: LineRole, text: string, lead?: string): ActionBlock {
    return { kind: 'line', role, text, ...(lead ? { lead } : {}) }
}

/** R-X.1 The one waiting line, for every state: "Waiting on <chip>." */
function waitingLine(session: PanelSession, playerIds: readonly string[]): ActionBlock {
    const on = playerIds.map((playerId) => ({
        playerId,
        name: session.getPlayerName(playerId),
        paint: session.paintOf(playerId)
    }))
    return { kind: 'line', role: 'waiting', text: waitingWords(on.map(({ name }) => name)), on }
}

/** The tray's stage line, with its phone wording when the card's flow has one. */
function trayLine(text: string, short: string | undefined): ActionBlock {
    return { kind: 'line', role: 'flow', text, ...(short ? { short } : {}) }
}

function rows(name: string, entries: readonly ActionRow[], heading?: string): ActionBlock[] {
    return entries.length > 0
        ? [{ kind: 'rows', name, rows: entries, ...(heading ? { heading } : {}) }]
        : []
}

function draftRow(
    session: PanelSession,
    choice: DraftChoice,
    art: RowArt | undefined = choice.art
): ActionRow {
    return {
        choice,
        press: () => session.pressDraftChoice(choice),
        ...(art ? { art } : {})
    }
}

/** A turn row's piece: a tile as it is, a pawn the seat's own, in its paint. */
function turnRow(session: PanelSession, choice: PanelChoice): ActionRow {
    const art: RowArt | undefined =
        choice.art?.kind === 'pawn'
            ? { ...choice.art, paint: session.paintOf(session.myPlayerId ?? '') }
            : choice.art
    return { choice, press: () => session.pressTurnChoice(choice), ...(art ? { art } : {}) }
}

/**
 * R-1.4.8 The picked sulfur's destination, on a line of its own under the goods, in the Merchant
 * basket's words; each choice's name says what it does.
 */
const SulfurChoices = [
    { to: 'supply', label: 'Keep the sulfur', shown: 'Keep it' },
    { to: 'barrel', label: 'Put the sulfur into the barrel', shown: 'Into the barrel' }
] as const

function sulfurLine(session: PanelSession, sulfurTo: SulfurDestination | undefined): ActionBlock[] {
    if (!sulfurTo) {
        return []
    }
    return [
        {
            kind: 'rows',
            name: 'sulfur',
            heading: 'Sulfur:',
            line: true,
            rows: SulfurChoices.map(({ to, label, shown }) => ({
                choice: { label, shown, picked: sulfurTo === to },
                press: () => session.chooseSulfurDestination(to)
            }))
        }
    ]
}

function goodsBlocks(
    session: PanelSession,
    panel: NonNullable<PanelSession['startingGoodsPanel']>
): ActionBlock[] {
    if (!panel.deciding) {
        return [
            waitingLine(session, [panel.deciderId]),
            {
                kind: 'goods-counts',
                counts: panel.goods.map(({ good, count }) => ({ good, count }))
            }
        ]
    }
    return [
        ...rows(
            'goods',
            panel.goods.map(({ good, count, picked, refusal }) => ({
                choice: plainChoice(`${titled(good)} ${count}`, picked, refusal),
                press: () => session.pressStartingGood(good),
                art: { kind: 'good', good }
            }))
        ),
        ...sulfurLine(session, panel.sulfurTo),
        ...(panel.primary ? [primaryBlock(panel.primary, () => session.sendStartingGoods())] : [])
    ]
}

function pawnBlocks(
    session: PanelSession,
    panel: NonNullable<PanelSession['startingPawnPanel']>
): ActionBlock[] {
    if (!panel.deciding) {
        return [waitingLine(session, [panel.deciderId])]
    }
    if (panel.asksCharacter) {
        return [line('flow', 'Choose who stands here')]
    }
    return [
        line('flow', 'Press a starting space, or a character'),
        ...rows(
            'characters',
            panel.characters.map(({ character, rank, picked }) => {
                const { label, art } = rankedDie(character, rank)
                return {
                    choice: { label, picked, lights: () => StartingSpaceIds.map(spaceTarget) },
                    press: () => session.pressStartingCharacter(character),
                    art
                }
            })
        )
    ]
}

/** R-3.1-H1 Choosing and finalising are simultaneous; the pouch goods are shown together. */
const FinaliseCaption = 'everyone at once · pouch goods shown when all have finalised'

function handBlocks(
    session: PanelSession,
    panel: NonNullable<PanelSession['handPanel']>
): ActionBlock[] {
    const { drafting, set } = panel
    const lead = drafting?.line ?? set?.line
    const finalise: ActionBlock = {
        kind: 'finalise',
        entries: panel.finaliseRow.map((entry) => ({
            ...entry,
            name: session.getPlayerName(entry.playerId),
            paint: session.paintOf(entry.playerId),
            you: entry.playerId === session.myPlayerId,
            awaited: set !== undefined && !entry.finalised
        })),
        caption: FinaliseCaption,
        ...(lead ? { lead } : {})
    }
    const paint = session.paintOf(session.myPlayerId ?? '')
    if (!drafting) {
        return [
            finalise,
            ...(set
                ? [
                      {
                          kind: 'hand-set' as const,
                          paint,
                          cards: set.cards.map((kind) => ({ kind, ...cardFace(kind) })),
                          ...(set.pouch ? { pouch: set.pouch } : {})
                      }
                  ]
                : []),
            ...(panel.waitingOn ? [waitingLine(session, panel.waitingOn)] : []),
            ...atWillBlocks(session)
        ]
    }
    const cards = drafting.cards.map(({ kind, picked, slot }): CardRow => ({
        kind,
        ...cardFace(kind),
        picked,
        ...(slot ? { slot } : {}),
        press: () => session.toggleHandCard(kind)
    }))
    const beside: ActionBlock[] = [
        finalise,
        line('count', drafting.count, 'Hand'),
        {
            kind: 'slots',
            paint,
            slots: drafting.slots.map((kind, at) => {
                const card = cards.find((row) => row.kind === kind)
                return { at: at + 1, ...(card ? { card } : {}) }
            }),
            caption: 'play in any order'
        },
        {
            kind: 'rows',
            name: 'pouch',
            heading: 'Pouch',
            hint: 'one or none',
            rows: drafting.pouch.map(({ good, label, title, caption, picked, refusal }) => ({
                choice: { ...plainChoice(label, picked, refusal), shown: title },
                press: () => session.choosePouch(good),
                art: { kind: 'good', good },
                caption
            }))
        },
        ...(drafting.conquerWarning ? [line('warning', drafting.conquerWarning)] : []),
        primaryBlock(drafting.primary, () => session.finaliseHand()),
        ...atWillBlocks(session)
    ]
    return [
        { kind: 'cards', tone: 'draft', paint, rows: cards },
        ...beside.map((block): ActionBlock => ({ ...block, stands: 'draft' }))
    ]
}

/** R-4.4-H1 The at-will row under the hand, and the one list open: what the draft offers, drawn. */
function atWillBlocks(session: PanelSession): ActionBlock[] {
    const panel = session.atWillPanel
    if (!panel) {
        return []
    }
    const asRows = (choices: readonly DraftChoice[] | undefined) =>
        (choices ?? []).map((choice) => draftRow(session, choice))
    return [
        ...rows('at-will', asRows(panel.chips)),
        ...(panel.line ? [line('flow', panel.line)] : []),
        ...(panel.writs
            ? [
                  {
                      kind: 'writ-offers',
                      offers: panel.writs.map(({ writId, name, choices }) => ({
                          writId,
                          name,
                          rows: asRows(choices)
                      }))
                  } satisfies ActionBlock
              ]
            : []),
        // R-4.3.3 Every row is its tile, drawn, and reads "Spend".
        ...(panel.tiles ?? []).flatMap((tile) =>
            rows(`tile:${tile.tileId}`, [draftRow(session, tile)])
        ),
        ...rows(
            'goods',
            (panel.goods ?? []).map((choice) =>
                draftRow(session, choice, { kind: 'good', good: choice.good })
            )
        ),
        ...rows('vessels', asRows(panel.vessels)),
        ...rows('covers', asRows(panel.covers)),
        ...(panel.primary ? [primaryBlock(panel.primary, () => session.sendFollowUp())] : [])
    ]
}

/** R-4.4-H5 In a hotseat, each other seat holding a writ: its chip, then its writs once pressed. */
function offTurnDiscardBlocks(session: PanelSession): ActionBlock[] {
    const panel = session.offTurnDiscardPanel
    if (!panel) {
        return []
    }
    const asRows = (choices: readonly DraftChoice[]) =>
        choices.map((choice) => draftRow(session, choice))
    return [
        ...rows('off-turn-writs', asRows(panel.chips)),
        ...(panel.writs
            ? [
                  {
                      kind: 'writ-offers',
                      offers: panel.writs.map(({ writId, name, choices }) => ({
                          writId,
                          name,
                          rows: asRows(choices)
                      }))
                  } satisfies ActionBlock
              ]
            : [])
    ]
}

function keepBlocks(
    session: PanelSession,
    panel: NonNullable<PanelSession['keepWritsPanel']>
): ActionBlock[] {
    return [
        line('flow', panel.line),
        {
            kind: 'writs',
            rows: panel.writs.map((writ) => ({
                writId: writ.writId,
                choice: writ,
                press: () => session.pressDraftChoice(writ)
            }))
        },
        ...rows(
            'covers',
            (panel.covers ?? []).map((choice) => draftRow(session, choice))
        ),
        primaryBlock(panel.primary, () => session.sendFollowUp()),
        ...(panel.shovels ? [primaryBlock(panel.shovels, () => session.keepThenShovels())] : [])
    ]
}

function favoursBlocks(
    session: PanelSession,
    panel: NonNullable<PanelSession['favoursPanel']>
): ActionBlock[] {
    return [
        line('flow', panel.line),
        ...rows(
            'goods',
            panel.goods.map((choice) =>
                draftRow(session, choice, { kind: 'good', good: choice.good })
            )
        ),
        ...rows(
            'barrel',
            (panel.barrel ?? []).map((choice) => draftRow(session, choice))
        ),
        ...(panel.note ? [line('note', panel.note)] : []),
        ...rows('answer', [
            {
                choice: plainChoice(panel.noFavours, false),
                press: () => session.chooseNoFavours()
            }
        ]),
        primaryBlock(panel.primary, () => session.sendFollowUp())
    ]
}

function discBlocks(
    session: PanelSession,
    panel: NonNullable<PanelSession['discPanel']>
): ActionBlock[] {
    return [
        line('flow', panel.line),
        ...(panel.covers ? [line('note', panel.covers)] : []),
        line('note', panel.freeDiscs),
        ...rows('disc', [draftRow(session, panel.place), draftRow(session, panel.keep)]),
        ...(panel.primary ? [primaryBlock(panel.primary, () => session.sendFollowUp())] : [])
    ]
}

/** R-3.14.1 An ask's buttons send at its press; it is never answered for the seat. */
function answerAttackBlocks(
    session: PanelSession,
    panel: NonNullable<PanelSession['answerAttackPanel']>
): ActionBlock[] {
    const { flip } = panel
    return [
        line('flow', panel.line),
        ...(panel.noDefend ? [line('note', panel.noDefend)] : []),
        ...(flip
            ? [primaryBlock({ ...flip, enabled: true }, () => session.answerAttack(true))]
            : []),
        primaryBlock({ ...panel.letStand, enabled: true }, () => session.answerAttack(false))
    ]
}

/** R-3.14.2 */
function answerStarveBlocks(
    session: PanelSession,
    panel: NonNullable<PanelSession['answerStarvePanel']>
): ActionBlock[] {
    return [
        line('flow', panel.line),
        ...(panel.cantAnswer ? [line('note', panel.cantAnswer)] : []),
        ...rows(
            'covers',
            (panel.covers ?? []).map((choice) => draftRow(session, choice))
        ),
        ...(panel.immunity
            ? [primaryBlock(panel.immunity, () => session.answerStarveWith(true))]
            : []),
        primaryBlock({ ...panel.letGo, enabled: true }, () => session.answerStarveWith(false))
    ]
}

/** R-4.8 The attacker's own preview of the tally, the stepper and the weapons. */
function commitBlocks(
    session: PanelSession,
    panel: NonNullable<PanelSession['commitPanel']>
): ActionBlock[] {
    const { saltpeter } = panel
    return [
        line('flow', 'Add to the attack'),
        { kind: 'tally', lines: panel.tally },
        ...rows(
            'saltpeter',
            [draftRow(session, saltpeter.add), draftRow(session, saltpeter.remove)],
            `Saltpeter ${saltpeter.count}`
        ),
        ...(panel.weapons.length > 0
            ? [
                  {
                      kind: 'writ-offers',
                      offers: panel.weapons.map(({ writId, alternatives }) => ({
                          writId,
                          name: writName(writId),
                          rows: alternatives.map((choice) => draftRow(session, choice))
                      }))
                  } satisfies ActionBlock
              ]
            : []),
        ...rows(
            'covers',
            (panel.covers ?? []).map((choice) => draftRow(session, choice))
        ),
        primaryBlock(panel.primary, () => session.sendFollowUp())
    ]
}

/** R-4.4.4 */
function writLimitBlocks(
    session: PanelSession,
    panel: NonNullable<PanelSession['writLimitPanel']>
): ActionBlock[] {
    return [
        line('flow', panel.line),
        {
            kind: 'writs',
            rows: panel.writs.map((writ) => ({
                writId: writ.writId,
                choice: writ,
                press: () => session.pressDraftChoice(writ)
            }))
        },
        primaryBlock(panel.primary, () => session.sendFollowUp()),
        ...atWillBlocks(session)
    ]
}

/** R-4.10.1 The picker: each pawn to feed, its feeds as rows that brighten it, and the summary. */
function nourishBlocks(
    session: PanelSession,
    panel: NonNullable<PanelSession['nourishPanel']>
): ActionBlock[] {
    const paint = session.paintOf(session.myPlayerId ?? '')
    return [
        line('flow', 'Feed your pawns'),
        {
            kind: 'nourish-picker',
            pawns: panel.pawns.map(({ n, character, name, place, unfed, choices }) => ({
                n,
                character,
                name,
                place,
                paint,
                unfed,
                options: choices.map(({ feed, caption, spent, good, ...choice }) => ({
                    ...draftRow(session, choice, good && { kind: 'good', good }),
                    feed,
                    caption,
                    spent
                }))
            })),
            summary: panel.summary,
            rule: panel.rule,
            ...(panel.covers && panel.coverLine
                ? {
                      covers: {
                          line: panel.coverLine,
                          rows: panel.covers.map((choice) => draftRow(session, choice))
                      }
                  }
                : {}),
            send: {
                ...primaryBlock(panel.primary, () => session.sendFollowUp()),
                tally: panel.send
            }
        },
        ...atWillBlocks(session)
    ]
}

/** R-4.3.4 Each filled landscape, with what collecting it pays. */
function landscapesBlocks(
    session: PanelSession,
    panel: NonNullable<PanelSession['landscapesPanel']>
): ActionBlock[] {
    return [
        line('flow', 'Collect your landscapes'),
        ...panel.spaces.flatMap((space) =>
            rows(`landscape:${space.spaceId}`, [draftRow(session, space)], space.place)
        ),
        ...rows(
            'barrel',
            (panel.barrel ?? []).map((choice) => draftRow(session, choice))
        ),
        primaryBlock(panel.primary, () => session.sendFollowUp())
    ]
}

/**
 * R-3.2 The hand in one line, its at-will chips at the line's end; once a card is picked, all that
 * card asks stands in a tray beside it: its line, modes, follow-up rows and send, then Forfeit, last
 * and quiet (contract: Playing a card).
 */
/** R-4.6 The bench's staged moves as the tray's lines, each with its take-back. */
function stagedBlocks(session: PanelSession, bench: BenchOffer): ActionBlock[] {
    const state = session.gameState
    const moves = stagedMoves(benchViewOf(bench, state, session.myPlayerId ?? ''), bench)
    if (!moves) {
        return []
    }
    const rowPaint = (row: number): SeatPaint | undefined => {
        const held = state.guilds.knight.rows.at(row)
        return (
            held &&
            (held.playerId ? session.paintOf(held.playerId) : session.colourPaintOf(held.colour))
        )
    }
    return [
        {
            kind: 'staged',
            ...(moves.tally ? { tally: moves.tally } : {}),
            lines: moves.lines.map(({ item, piece, text, words, takeBack }) => {
                const paint = piece?.kind === 'marker' ? rowPaint(piece.row) : undefined
                return {
                    item,
                    ...(piece ? { piece } : {}),
                    ...(paint ? { paint } : {}),
                    text,
                    words,
                    takeBack: {
                        choice: { label: `Take back ${words}`, shown: 'Take back', picked: false },
                        press: takeBack
                    }
                }
            })
        }
    ]
}

function turnBlocks(session: PanelSession, turn: NonNullable<PanelSession['turnPanel']>) {
    const move = session.movePanel
    const guild = session.guildPanel
    const flowLine = guild?.line ?? move?.line ?? turn.flow?.line
    const flowShort = flowLine === turn.flow?.line ? turn.flow?.short : undefined
    const primary = guild?.primary ?? move?.primary ?? turn.primary
    const me = session.myPlayerId ?? ''
    const secondRows: ActionRow[] = turn.secondCard
        ? [
              {
                  choice: plainChoice(turn.secondCard.label, turn.secondCard.on),
                  press: () => session.toggleTurnSecondCard()
              }
          ]
        : []
    const forfeitRows: ActionRow[] = turn.forfeit
        ? [
              {
                  choice: plainChoice(turn.forfeit, false),
                  press: () => session.forfeitTurnCard(),
                  quiet: true
              }
          ]
        : []
    const asTurnRows = (choices: readonly PanelChoice[] | undefined) =>
        (choices ?? []).map((choice) => turnRow(session, choice))
    const modeRows = asTurnRows(turn.modes.length > 1 ? turn.modes : []).map((row): ActionRow => ({
        ...row,
        explained: true
    }))
    const { tally, tallyNote } = turn.flow ?? {}
    const tallyBlocks: ActionBlock[] = tally
        ? [{ kind: 'tally', lines: tally, ...(tallyNote ? { note: tallyNote } : {}) }]
        : []
    const send = primary ? primaryBlock(primary, () => session.sendTurnCard()) : undefined
    const picker = guild?.bench && takesTradePicker(guild.bench) ? guild.bench : undefined
    // Contract, The trade picker: one control row heads the tray (the replay, the card's modes with
    // R-3.16.3 Feast, the second card, then Forfeit), and the picker with its send stands under it.
    // R-3.3, R-3.15 The second card and a replay are declared before a Buy that sends.
    const tray: ActionBlock[] = picker
        ? [
              ...rows('replays', asTurnRows(turn.replays)),
              ...rows('modes', modeRows),
              ...rows('second', secondRows),
              ...rows('card', forfeitRows),
              ...turn.refusals.map((text) => line('refusal', text)),
              { kind: 'trade-picker', bench: picker, ...(send ? { send } : {}) }
          ]
        : [
              ...(flowLine ? [trayLine(flowLine, flowShort)] : []),
              ...(guild?.bench ? stagedBlocks(session, guild.bench) : []),
              ...rows('replays', asTurnRows(turn.replays)),
              ...rows('modes', modeRows),
              ...turn.refusals.map((text) => line('refusal', text)),
              ...rows('move', asTurnRows(move?.rows)),
              ...rows('flow', asTurnRows(turn.flow?.rows)),
              ...tallyBlocks,
              ...rows('second', secondRows),
              ...(send ? [send] : []),
              ...rows('card', forfeitRows)
          ]
    return [
        line('turn', turn.line),
        {
            kind: 'cards',
            tone: 'hand',
            paint: session.paintOf(me),
            rows: turn.cards.map(({ kind, picked, lights }) => ({
                kind,
                ...cardFace(kind),
                picked,
                lights,
                press: () => session.pressTurnCard(kind)
            }))
        },
        ...atWillBlocks(session).map((block): ActionBlock =>
            block.kind === 'rows' && block.name === 'at-will'
                ? { ...block, stands: 'hand-end' }
                : block
        ),
        ...tray.map((block): ActionBlock => ({ ...block, stands: 'tray' }))
    ] satisfies ActionBlock[]
}

/** The decision of this moment, or the line of what the table waits for. */
function decisionBlocks(session: PanelSession): readonly ActionBlock[] {
    const goods = session.startingGoodsPanel
    const pawn = session.startingPawnPanel
    const hand = session.handPanel
    const answerAttack = session.answerAttackPanel
    const answerStarve = session.answerStarvePanel
    const keep = session.keepWritsPanel
    const favours = session.favoursPanel
    const commit = session.commitPanel
    const disc = session.discPanel
    const writLimit = session.writLimitPanel
    const nourish = session.nourishPanel
    const landscapes = session.landscapesPanel
    const turn = session.turnPanel
    const watching = session.watchingPanel
    if (goods) {
        return goodsBlocks(session, goods)
    }
    if (pawn) {
        return pawnBlocks(session, pawn)
    }
    if (hand) {
        return handBlocks(session, hand)
    }
    if (answerAttack) {
        return answerAttackBlocks(session, answerAttack)
    }
    if (answerStarve) {
        return answerStarveBlocks(session, answerStarve)
    }
    if (keep) {
        return keepBlocks(session, keep)
    }
    if (favours) {
        return favoursBlocks(session, favours)
    }
    if (commit) {
        return commitBlocks(session, commit)
    }
    if (disc) {
        return discBlocks(session, disc)
    }
    if (writLimit) {
        return writLimitBlocks(session, writLimit)
    }
    if (nourish) {
        return nourishBlocks(session, nourish)
    }
    if (landscapes) {
        return landscapesBlocks(session, landscapes)
    }
    if (turn) {
        return turnBlocks(session, turn)
    }
    return [
        ...(watching?.waitingOn ? [waitingLine(session, watching.waitingOn)] : []),
        ...(watching?.backs
            ? [{ kind: 'backs', count: watching.backs } satisfies ActionBlock]
            : []),
        ...atWillBlocks(session)
    ]
}

/** R-X.1 The waiting view ends with what the previous seat just did, as this seat's log reads it. */
function previousSeatBlocks({ watchingPanel, previousSeatLine }: PanelSession): ActionBlock[] {
    return watchingPanel?.waitingOn && previousSeatLine ? [line('previous', previousSeatLine)] : []
}

function seatNames(session: PanelSession): SeatNames {
    return {
        nameOf: (playerId) => session.getPlayerName(playerId),
        paintOf: session.paintOf
    }
}

/**
 * The live rows of a shared step: one read for every seat (contract: Render ownership). A seat with
 * its own preview of the tally, the attacker committing, draws that instead through the same block.
 */
function sharedBlocks(session: PanelSession): readonly ActionBlock[] {
    const { orderRow, combatTally, commitPanel } = session
    return [
        ...(combatTally && !commitPanel
            ? [{ kind: 'tally', lines: combatTally.lines } satisfies ActionBlock]
            : []),
        ...(orderRow
            ? [
                  {
                      ...orderRow,
                      kind: 'order-row',
                      seats: seatNames(session),
                      ...(session.myPlayerId ? { me: session.myPlayerId } : {})
                  } satisfies ActionBlock
              ]
            : [])
    ]
}

/** R-4.12 The dawn sheet, under whatever decision opened after it; R-4.11 the roll is the history's. */
function roundEndBlocks(session: PanelSession): readonly ActionBlock[] {
    const { roundEnd } = session
    if (!roundEnd) {
        return []
    }
    return [{ kind: 'dawn-sheet', sheet: roundEnd.dawn, seats: seatNames(session) }]
}

/**
 * The action panel of this moment, in the order it stands: read from the session's panels, which
 * read the logic's offers. One moment at a time: setup, then selection, then what the seat is asked
 * or owes, then its card, or else the line of what the table waits for. The first line names the step
 * for everyone, and a shared step's live row stands right under it; at game end the summary alone.
 */
export function actionPanelOf(session: PanelSession): ActionPanelView {
    const { gameEnd } = session
    if (gameEnd) {
        return { blocks: [{ kind: 'game-end', summary: gameEnd, seats: seatNames(session) }] }
    }
    const decision = decisionBlocks(session)
    const shared = sharedBlocks(session)
    const [first, ...rest] = decision
    const lineFirst = first?.kind === 'line'
    return {
        blocks: [
            ...(lineFirst ? [first] : []),
            ...shared,
            ...(lineFirst ? rest : decision),
            ...offTurnDiscardBlocks(session),
            ...previousSeatBlocks(session),
            ...roundEndBlocks(session)
        ]
    }
}
