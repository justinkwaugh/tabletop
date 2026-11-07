import {
    ActionCardKinds,
    ActionCards,
    StartingSpaceIds,
    type ActionCardKind,
    type Character,
    type Good,
    type PouchGood,
    type WritId
} from '@tabletop/feudum'
import { spaceTarget, type BoardTarget } from './boardOffer.js'
import type { PanelChoice, TallyLine } from './cardFlows.js'
import type { DraftChoice } from './deciderDraft.svelte.js'
import { seatPaint, type SeatPaint } from './seatPaint.js'
import type { FeudumGameSession } from './session.svelte.js'
import type { TurnPrimary } from './turnDraft.svelte.js'

export type RowArt =
    | { readonly kind: 'good'; readonly good: Good }
    | { readonly kind: 'pawn'; readonly character: Character; readonly paint: SeatPaint }

export interface ActionRow {
    readonly choice: PanelChoice
    readonly press: () => void | Promise<void>
    readonly art?: RowArt
    /** R-1.4.8 What this row asks beside itself: the sulfur's destination. */
    readonly popup?: readonly ActionRow[]
}

export interface CardRow {
    readonly kind: ActionCardKind
    /** The printed name: a row is found by it. */
    readonly label: string
    readonly number: number
    readonly picked: boolean
    readonly lights?: () => readonly BoardTarget[]
    readonly press: () => void | Promise<void>
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
    readonly pouchGood?: PouchGood
    readonly next: boolean
}

export type LineRole = 'turn' | 'flow' | 'count' | 'warning' | 'note' | 'waiting' | 'refusal'

export type ActionBlock =
    | { readonly kind: 'finalise'; readonly entries: readonly FinaliseEntry[] }
    | {
          readonly kind: 'line'
          readonly role: LineRole
          readonly text: string
          readonly lead?: string
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
    | {
          readonly kind: 'rows'
          readonly name: string
          /** A small heading: the row of pouch goods is one. */
          readonly heading?: string
          readonly rows: readonly ActionRow[]
      }
    | {
          readonly kind: 'tally'
          readonly lines: readonly TallyLine[]
          readonly note?: string
      }
    | {
          readonly kind: 'primary'
          readonly label: string
          readonly enabled: boolean
          readonly send: () => void | Promise<void>
      }

export interface ActionPanelView {
    readonly blocks: readonly ActionBlock[]
}

/** What the panel reads of a session; it restates no rule of its own. */
export type PanelSession = Pick<
    FeudumGameSession,
    | 'startingGoodsPanel'
    | 'startingPawnPanel'
    | 'handPanel'
    | 'keepWritsPanel'
    | 'favoursPanel'
    | 'discPanel'
    | 'turnPanel'
    | 'movePanel'
    | 'guildPanel'
    | 'watchingPanel'
    | 'colors'
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
>

function titled(word: string): string {
    return `${word.charAt(0).toUpperCase()}${word.slice(1)}`
}

function paintOf(session: PanelSession, playerId: string): SeatPaint {
    const initial = session.getPlayerName(playerId).charAt(0).toUpperCase()
    return seatPaint(session.colors, playerId, initial)
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

function primaryBlock(primary: TurnPrimary, send: () => void | Promise<void>): ActionBlock {
    return { kind: 'primary', label: primary.label, enabled: primary.enabled, send }
}

function line(role: LineRole, text: string, lead?: string): ActionBlock {
    return { kind: 'line', role, text, ...(lead ? { lead } : {}) }
}

function rows(name: string, entries: readonly ActionRow[], heading?: string): ActionBlock[] {
    return entries.length > 0
        ? [{ kind: 'rows', name, rows: entries, ...(heading ? { heading } : {}) }]
        : []
}

function draftRow(session: PanelSession, choice: DraftChoice, art?: RowArt): ActionRow {
    return {
        choice,
        press: () => session.pressDraftChoice(choice),
        ...(art ? { art } : {})
    }
}

function turnRow(session: PanelSession, choice: PanelChoice): ActionRow {
    return { choice, press: () => session.pressTurnChoice(choice) }
}

function goodsBlocks(
    session: PanelSession,
    panel: NonNullable<PanelSession['startingGoodsPanel']>
): ActionBlock[] {
    if (!panel.deciding) {
        return [
            line('waiting', panel.waitingLine ?? ''),
            {
                kind: 'goods-counts',
                counts: panel.goods.map(({ good, count }) => ({ good, count }))
            }
        ]
    }
    const destination = ['supply', 'barrel'] as const
    const sulfurPopup = destination.map((to): ActionRow => ({
        choice: plainChoice(`To ${to}`, panel.sulfurTo === to),
        press: () => session.chooseSulfurDestination(to)
    }))
    return [
        ...rows(
            'goods',
            panel.goods.map(({ good, count, picked, refusal }) => ({
                choice: plainChoice(`${titled(good)} ${count}`, picked, refusal),
                press: () => session.pressStartingGood(good),
                art: { kind: 'good', good },
                ...(good === 'sulfur' && panel.asksSulfurDestination ? { popup: sulfurPopup } : {})
            }))
        ),
        ...(panel.primary ? [primaryBlock(panel.primary, () => session.sendStartingGoods())] : [])
    ]
}

function pawnBlocks(
    session: PanelSession,
    panel: NonNullable<PanelSession['startingPawnPanel']>
): ActionBlock[] {
    if (!panel.deciding) {
        return [line('waiting', `${session.getPlayerName(panel.deciderId)} places a starting pawn`)]
    }
    if (panel.asksCharacter) {
        return [line('flow', 'Choose who stands here')]
    }
    const paint = paintOf(session, panel.deciderId)
    return [
        line('flow', 'Press a starting space, or a character'),
        ...rows(
            'characters',
            panel.characters.map(({ character, rankChip, picked }) => ({
                choice: {
                    label: titled(character),
                    note: { kind: 'role', label: rankChip },
                    picked,
                    lights: () => StartingSpaceIds.map(spaceTarget)
                },
                press: () => session.pressStartingCharacter(character),
                art: { kind: 'pawn', character, paint }
            }))
        )
    ]
}

function handBlocks(
    session: PanelSession,
    panel: NonNullable<PanelSession['handPanel']>
): ActionBlock[] {
    const finalise: ActionBlock = {
        kind: 'finalise',
        entries: panel.finaliseRow.map((entry) => ({
            ...entry,
            name: session.getPlayerName(entry.playerId),
            paint: paintOf(session, entry.playerId)
        }))
    }
    const { drafting } = panel
    if (!drafting) {
        const next = panel.finaliseRow.find((entry) => entry.next)
        return [
            finalise,
            ...(next
                ? [
                      line(
                          'waiting',
                          `Waiting for ${session.getPlayerName(next.playerId)} to finalise`
                      )
                  ]
                : [])
        ]
    }
    const me = session.myPlayerId ?? ''
    return [
        finalise,
        line('count', drafting.count, drafting.line),
        {
            kind: 'cards',
            tone: 'draft',
            paint: paintOf(session, me),
            rows: drafting.cards.map(({ kind, picked }) => ({
                kind,
                ...cardFace(kind),
                picked,
                press: () => session.toggleHandCard(kind)
            }))
        },
        ...rows(
            'pouch',
            drafting.pouch.map(({ good, label, picked, refusal }) => ({
                choice: plainChoice(label, picked, refusal),
                press: () => session.choosePouch(good),
                ...(good ? { art: { kind: 'good', good } } : {})
            })),
            'Pouch'
        ),
        ...(drafting.conquerWarning ? [line('warning', drafting.conquerWarning)] : []),
        primaryBlock(drafting.primary, () => session.finaliseHand())
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

function turnBlocks(session: PanelSession, turn: NonNullable<PanelSession['turnPanel']>) {
    const move = session.movePanel
    const guild = session.guildPanel
    const flowLine = guild?.line ?? move?.line ?? turn.flow?.line
    const primary = guild?.primary ?? move?.primary ?? turn.primary
    const me = session.myPlayerId ?? ''
    const cardRows: ActionRow[] = [
        ...(turn.secondCard
            ? [
                  {
                      choice: plainChoice(turn.secondCard.label, turn.secondCard.on),
                      press: () => session.toggleTurnSecondCard()
                  }
              ]
            : []),
        ...(turn.forfeit
            ? [
                  {
                      choice: plainChoice(turn.forfeit, false),
                      press: () => session.forfeitTurnCard()
                  }
              ]
            : [])
    ]
    const asTurnRows = (choices: readonly PanelChoice[] | undefined) =>
        (choices ?? []).map((choice) => turnRow(session, choice))
    const { tally, tallyNote } = turn.flow ?? {}
    const tallyBlocks: ActionBlock[] = tally
        ? [{ kind: 'tally', lines: tally, ...(tallyNote ? { note: tallyNote } : {}) }]
        : []
    return [
        line('turn', turn.line),
        ...(flowLine ? [line('flow', flowLine)] : []),
        {
            kind: 'cards',
            tone: 'hand',
            paint: paintOf(session, me),
            rows: turn.cards.map(({ kind, picked, lights }) => ({
                kind,
                ...cardFace(kind),
                picked,
                lights,
                press: () => session.pressTurnCard(kind)
            }))
        },
        ...rows('replays', asTurnRows(turn.replays)),
        ...rows('modes', asTurnRows(turn.modes.length > 1 ? turn.modes : [])),
        ...turn.refusals.map((text) => line('refusal', text)),
        ...rows('move', asTurnRows(move?.rows)),
        ...rows('flow', asTurnRows(turn.flow?.rows)),
        ...tallyBlocks,
        ...rows('card', cardRows),
        ...(primary ? [primaryBlock(primary, () => session.sendTurnCard())] : [])
    ] satisfies ActionBlock[]
}

/**
 * The action panel of this moment, in the order it stands: read from the session's panels, which
 * read the logic's offers. One moment at a time: setup, then selection, then a follow-up the seat
 * owes, then its card, or else the line of what the table waits for.
 */
export function actionPanelOf(session: PanelSession): ActionPanelView {
    const blocks = (): readonly ActionBlock[] => {
        const goods = session.startingGoodsPanel
        const pawn = session.startingPawnPanel
        const hand = session.handPanel
        const keep = session.keepWritsPanel
        const favours = session.favoursPanel
        const disc = session.discPanel
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
        if (keep) {
            return keepBlocks(session, keep)
        }
        if (favours) {
            return favoursBlocks(session, favours)
        }
        if (disc) {
            return discBlocks(session, disc)
        }
        if (turn) {
            return turnBlocks(session, turn)
        }
        return watching?.line ? [line('waiting', watching.line)] : []
    }
    return { blocks: blocks() }
}
