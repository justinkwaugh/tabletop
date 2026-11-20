import { flushSync, mount } from 'svelte'
import type { ActionCardKind, WritId } from '@tabletop/feudum'
import GameTable from '$lib/components/GameTable.svelte'
import { pressCard, primaryNamed } from './actionPanelView.js'
import { askedToDefend, askedToStarve, type AskTable } from './askTable.js'
import {
    atCollecting,
    atNourishing,
    atNourishingTogether,
    fillBarrel,
    holdFood,
    holdWrit,
    seatedAtCards,
    threePawns
} from './followUpTable.js'
import { playOutRound, tendLandscape, type DawnEpoch } from './roundEndTable.js'
import { settled } from './sessionHarness.js'
import { giveGood, giveSeal, giveTile } from './turnTable.js'
import type { FeudumGameSession } from '$lib/model/session.svelte.js'

export type AskRole = 'attacker' | 'asked' | 'third'

const Held: readonly ActionCardKind[] = ['defend', 'tax']
const NotHeld: readonly ActionCardKind[] = ['tax', 'guild']
const Charter: WritId = 'writ.charter.monster-defeat'
const Mandate: WritId = 'writ.mandate.5'
const OverLimit: readonly WritId[] = [
    'writ.mandate.5',
    'writ.mandate.2',
    'writ.mandate.4',
    'writ.mandate.7'
]
const FinalEpoch: DawnEpoch = 5

function byRole(table: AskTable, role: AskRole): FeudumGameSession {
    return { attacker: table.session, asked: table.asked, third: table.third }[role]
}

/** The real table on a browser's page, its session on the host of a spec. */
async function show(session: FeudumGameSession) {
    await settled(session)
    const target = document.createElement('div')
    target.dataset.gameUi = 'feudum'
    target.style.height = '100vh'
    document.body.replaceChildren(target)
    Object.assign(window, { feudumSession: session })
    mount(GameTable, { target, props: { gameSession: session } })
    flushSync()
}

/** R-3.14.1 The Conquer sent; whichever seat is looking, with or without Defend in the asked hand. */
export async function openDefendTable(held: boolean, role: AskRole) {
    await show(byRole(await askedToDefend(held ? Held : NotHeld), role))
}

/** R-3.14.2 The starve sent; whichever seat is looking. */
export async function openStarveTable(held: boolean, role: AskRole) {
    await show(byRole(await askedToStarve(held ? Held : NotHeld), role))
}

/** R-4.8 The attacker can add saltpeter, after the defender let it stand. */
export async function openCommitTable(role: AskRole) {
    const table = await askedToDefend(NotHeld, (state, seat) => {
        giveGood(state, seat, 'saltpeter')
        giveGood(state, seat, 'saltpeter')
    })
    await primaryNamed(table.asked.actionPanel, /^Let it stand/).send()
    await settled(table.session)
    await settled(table.third)
    await show(byRole(table, role))
}

/** R-4.4 A mandate, a charter, tiles and an idle seal at the seat's hand. */
export async function openAtWillTable() {
    const table = await seatedAtCards(['tax', 'move', 'guild'], (state, { seat }) => {
        holdFood(state, seat, 1)
        holdWrit(state, seat, Mandate)
        giveSeal(state, seat)
        holdWrit(state, seat, Charter)
        giveTile(state, seat)
        giveTile(state, seat)
    })
    await show(table.session)
}

/** R-4.4.4 One writ over the limit, once the card is played. */
export async function openWritLimitTable() {
    const table = await seatedAtCards(['tax', 'move'], (state, { seat }) => {
        holdFood(state, seat, 1)
        for (const writId of OverLimit) {
            holdWrit(state, seat, writId)
        }
    })
    await pressCard(table.session.actionPanel, 'tax')
    await table.session.forfeitTurnCard()
    await show(table.session)
}

/** R-4.10.1 Three pawns, a food and a wine: the third must go unfed or take the wine. */
export async function openNourishTable(role: 'seat' | 'other') {
    const table = await atNourishing((state, { seat }) => {
        threePawns(state, seat)
        holdFood(state, seat, 1)
        fillBarrel(state, seat, 1)
    })
    await show(role === 'seat' ? table.session : await table.host.openSeat(table.other))
}

/**
 * R-4.10-H4 Two seats asked at once, each with three pawns, a food and a wine: one hotseat screen
 * playing every seat, or the third seat, which nourishing doesn't ask, watching.
 */
export async function openNourishTogetherTable(role: 'hotseat' | 'watcher') {
    const table = await atNourishingTogether((state, { seat, other }) => {
        for (const playerId of [seat, other]) {
            threePawns(state, playerId)
            holdFood(state, playerId, 1)
            fillBarrel(state, playerId, 1)
        }
    })
    const watcher = table.host.order.find((id) => id !== table.seat && id !== table.other) ?? ''
    await show(
        role === 'hotseat' ? await table.host.openHotseat() : await table.host.openSeat(watcher)
    )
}

/** R-4.3.4 Two filled landscapes for the seat to collect. */
export async function openLandscapesTable(role: 'seat' | 'other') {
    const table = await atCollecting()
    await show(role === 'seat' ? table.session : await table.host.openSeat(table.other))
}

/** R-4.12 The dawn of epoch II has played; the next decision is open under the sheet. */
export async function openDawnTable() {
    const table = await playOutRound(2, (state, { seat, other }) => {
        tendLandscape(state, other, seat)
    })
    await show(table.session)
}

/** R-6.2, R-6.3 The game is over; R-4.4.3 the held seal went on the held charter at its end. */
export async function openGameEndTable() {
    const table = await playOutRound(FinalEpoch, (state, { seat }) => {
        giveSeal(state, seat)
        holdWrit(state, seat, Charter)
    })
    await show(table.session)
}
