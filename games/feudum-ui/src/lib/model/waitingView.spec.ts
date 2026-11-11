import { flushSync } from 'svelte'
import { afterEach, describe, expect, it } from 'vitest'
import {
    ActionType,
    DiscardAnyTime,
    MachineState,
    isBeginDawn,
    isRollProgressDie,
    isScoreGame,
    placeMarker,
    type TriggeredEpoch,
    type WritId
} from '@tabletop/feudum'
import { ActionSource, assertExists } from '@tabletop/common'
import { blockOf, linesOf, primaryNamed, primaryLabels } from '$lib/testing/actionPanelView.js'
import {
    askedToDefend,
    askedToStarve,
    stagedConquer,
    type AskTable
} from '$lib/testing/askTable.js'
import {
    atCollecting,
    atNourishing,
    fillBarrel,
    holdFood,
    holdWrit,
    seatedAtCards,
    threePawns
} from '$lib/testing/followUpTable.js'
import { playOutRound, tendLandscape } from '$lib/testing/roundEndTable.js'
import { settled, type FeudumHost } from '$lib/testing/sessionHarness.js'
import {
    atPlayingCards,
    buildFeudum,
    emptySpaces,
    giveGood,
    giveSeal,
    returnGoods
} from '$lib/testing/turnTable.js'

import { tileName } from './tileName.js'
import type { ActionPanelView } from './actionPanel.js'
import type { FeudumGameSession } from './session.svelte.js'

const hosts: FeudumHost[] = []

function hold<T extends { host: FeudumHost }>(table: T): T {
    hosts.push(table.host)
    return table
}

afterEach(() => {
    for (const host of hosts.splice(0)) {
        host.close()
    }
})

/**
 * Differ between any two tables, held or not: the checksum hashes only each Action's generated id and
 * index (`calculateActionChecksum`), and a seat's Action takes a fresh id.
 */
const Generated = ['id', 'createdAt', 'updatedAt', 'actionChecksum']

function isChecksumPatch(entry: unknown): boolean {
    return (
        typeof entry === 'object' &&
        entry !== null &&
        'path' in entry &&
        entry.path === '/actionChecksum'
    )
}

/** What survives in markup and on the wire: functions drop, maps list, generated ids and times go. */
function plain(value: unknown): unknown {
    return JSON.parse(
        JSON.stringify(value, (key, entry: unknown) => {
            if (Generated.includes(key) || isChecksumPatch(entry)) {
                return undefined
            }
            return entry instanceof Map ? [...entry.entries()] : entry
        })
    )
}

/**
 * Everything a seat's screen is derived from. Two worlds differing only in the asked seat's concealed
 * hand must agree on all of it for any other seat.
 */
function seen(session: FeudumGameSession, order: readonly string[]) {
    return plain({
        panel: session.actionPanel,
        watching: session.watchingPanel,
        tally: session.combatTally,
        board: session.boardOffer,
        seats: order.map((playerId) => session.seatPanel(playerId)),
        isMyTurn: session.isMyTurn,
        valid: session.validActionTypes,
        undo: session.undoableAction,
        popup: session.boardPopup,
        state: session.gameState.dehydrate(),
        actions: session.actions
    })
}

/** R-3.14-H1 The asked seat's hand is the one difference: the hand's size is the same. */
/** R-4.4-H5 A writ its holder may discard at any time. */
const AnyTimeWrit: WritId = 'writ.mandate.1'

const Held = ['defend', 'tax'] as const
const NotHeld = ['tax', 'guild'] as const

/**
 * One world at a time, closed before the next opens: the harness's notification service is shared by
 * every session in a spec, so two open tables would hear each other.
 */
async function worldOf<T extends { host: FeudumHost }, R>(
    build: () => Promise<T>,
    read: (table: T) => R | Promise<R>
): Promise<R> {
    const table = await build()
    const result = await read(table)
    table.host.close()
    return result
}

describe('S34, R-3.14-H1 no other seat depends on whether Defend is held', () => {
    const others = ({ session, third, host }: AskTable) =>
        [session, third].map((seat) => seen(seat, host.order))

    it('S34 before the send: the attacker reads the same chip and primary', async () => {
        const read = ({ session, host }: AskTable) => ({
            primary: primaryLabels(session.actionPanel),
            seen: seen(session, host.order)
        })
        const held = await worldOf(() => stagedConquer(Held), read)
        const not = await worldOf(() => stagedConquer(NotHeld), read)
        expect(not).toEqual(held)
    })

    it('S34 while asked: the attacker and the third seat derive the same in every field', async () => {
        const read = (table: AskTable) => ({
            others: others(table),
            asked: primaryLabels(table.asked.actionPanel)
        })
        const held = await worldOf(() => askedToDefend(Held), read)
        const not = await worldOf(() => askedToDefend(NotHeld), read)
        expect(not.others).toEqual(held.others)
        // The worlds do differ, for the asked seat alone.
        expect(not.asked).not.toEqual(held.asked)
    })

    it('S34 once it stands: the same, whichever hand let it stand', async () => {
        const read = async (table: AskTable) => {
            await primaryNamed(table.asked.actionPanel, /^Let it stand/).send()
            await settled(table.asked)
            await settled(table.session)
            await settled(table.third)
            return others(table)
        }
        // The Action reaches them with its own input, and the concealed hand nowhere in it.
        const held = await worldOf(() => askedToDefend(Held), read)
        const not = await worldOf(() => askedToDefend(NotHeld), read)
        expect(not).toEqual(held)
    })

    it('S38 starving: the attacker and the third seat derive the same in every field', async () => {
        const read = (table: AskTable) => ({
            others: others(table),
            asked: primaryLabels(table.asked.actionPanel)
        })
        const held = await worldOf(() => askedToStarve(Held), read)
        const not = await worldOf(() => askedToStarve(NotHeld), read)
        expect(not.others).toEqual(held.others)
        expect(not.asked).not.toEqual(held.asked)
    })

    it('S38 once let go: the same, whichever hand let it go', async () => {
        const read = async (table: AskTable) => {
            await primaryNamed(table.asked.actionPanel, /^Let it go/).send()
            await settled(table.asked)
            await settled(table.session)
            await settled(table.third)
            return others(table)
        }
        const held = await worldOf(() => askedToStarve(Held), read)
        const not = await worldOf(() => askedToStarve(NotHeld), read)
        expect(not).toEqual(held)
    })

    it("R-3.14.1 no line, button or chip elsewhere names the asked seat's hand", async () => {
        const table = hold(await askedToDefend(Held))
        for (const seat of [table.session, table.third]) {
            expect(JSON.stringify(plain(seat.actionPanel))).not.toMatch(/Defend|holds?\b/)
        }
    })

    it('R-3.14.1 the seat is asked in both worlds: nothing goes for it, however long it waits', async () => {
        for (const hand of [Held, NotHeld]) {
            await worldOf(
                () => askedToDefend(hand),
                async (table) => {
                    const before = table.host.actions.length
                    await settled(table.asked)
                    await settled(table.session)
                    expect(table.host.actions).toHaveLength(before)
                    expect(table.asked.gameState.machineState).toBe(MachineState.AwaitingDefence)
                    expect(table.asked.isMyTurn).toBe(true)
                }
            )
        }
    })
})

function sharedOf(view: ActionPanelView) {
    return view.blocks.filter(({ kind }) =>
        ['tally', 'order-row', 'finalise', 'dawn-sheet'].includes(kind)
    )
}

describe('Render ownership: each shared row reads the same for every seat', () => {
    it('the combat tally: the same block for attacker, defender and third seat', async () => {
        const table = hold(await askedToDefend(Held))
        const { session, asked, third } = table
        const block = blockOf(third.actionPanel, 'tally')
        expect(block?.lines.at(-1)?.source).toBe('total')
        expect(plain(blockOf(session.actionPanel, 'tally'))).toEqual(plain(block))
        expect(plain(blockOf(asked.actionPanel, 'tally'))).toEqual(plain(block))
    })

    it('R-3.14.1 "answers" reads once for every seat but the defender, who reads it nowhere', async () => {
        const table = hold(await askedToDefend(Held))
        const { session, asked, third } = table
        const answers = `${asked.getPlayerName(table.other)} answers`
        const timesRead = (seat: FeudumGameSession) =>
            JSON.stringify(plain(seat.actionPanel)).split(answers).length - 1
        expect(timesRead(session)).toBe(1)
        expect(timesRead(third)).toBe(1)
        expect(timesRead(asked)).toBe(0)
    })

    it('R-4.8 a flipped Defend is what the tally reads, once it has been shown', async () => {
        const table = hold(
            await askedToDefend(Held, (state, seat) => {
                giveGood(state, seat, 'saltpeter')
            })
        )
        const { session, asked, third } = table
        await primaryNamed(asked.actionPanel, /^Flip Defend/).send()
        await settled(asked)
        await settled(session)
        await settled(third)
        const line = blockOf(third.actionPanel, 'tally')?.lines.find(
            ({ source }) => source === 'defend'
        )
        expect(line?.defence).toBe(1)
        expect(plain(blockOf(asked.actionPanel, 'tally'))).toEqual(
            plain(blockOf(third.actionPanel, 'tally'))
        )
    })

    it('S53 the nourish row: ticks and "fed by the game", the same above the panel and in waiting', async () => {
        const table = hold(
            await atNourishing((state, { seat }) => {
                threePawns(state, seat)
                holdFood(state, seat, 1)
                fillBarrel(state, seat, 1)
            })
        )
        const other = await table.host.openSeat(table.other)
        await settled(other)
        const row = blockOf(other.actionPanel, 'order-row')
        expect(row?.step).toBe('nourish')
        expect(row?.entries.map(({ playerId }) => playerId)).toEqual(table.host.order)
        expect(row?.entries.find(({ playerId }) => playerId === table.seat)).toMatchObject({
            next: true,
            done: false
        })
        expect(row?.entries.find(({ playerId }) => playerId === table.other)?.done).toBe(true)
        expect(plain(blockOf(table.session.actionPanel, 'order-row'))).toEqual(plain(row))
        const name = other.getPlayerName(table.seat)
        expect(linesOf(other.actionPanel, 'waiting')[0]).toContain(name)
        expect(other.actionPanel.blocks[0]).toMatchObject({ kind: 'line', role: 'waiting' })
    })

    it('S55 the landscapes row: the same above the panel and in waiting', async () => {
        const table = hold(await atCollecting())
        const other = await table.host.openSeat(table.other)
        await settled(other)
        const row = blockOf(other.actionPanel, 'order-row')
        expect(row?.step).toBe('landscapes')
        expect(plain(blockOf(table.session.actionPanel, 'order-row'))).toEqual(plain(row))
    })

    it('R-3.1 the finalise row: the same for the finaliser and those waiting', async () => {
        const { host } = await atPlayingCards(['move', 'tax'])
        hosts.push(host)
        host.edit((state) => {
            state.flow.selection = {
                playerId: host.order[0],
                finalised: []
            }
            state.machineState = MachineState.SelectingHands
            state.activePlayerIds = [host.order[0]]
        })
        const first = await host.openSeat(host.order[0])
        const second = await host.openSeat(host.order[1])
        await settled(first)
        await settled(second)
        expect(blockOf(first.actionPanel, 'finalise')).toBeDefined()
        expect(plain(blockOf(second.actionPanel, 'finalise'))).toEqual(
            plain(blockOf(first.actionPanel, 'finalise'))
        )
    })
})

describe('R-X.1 the waiting view names who decides and what', () => {
    it('S18 the drawn count as backs, "keeps 1"; a hidden hand gives no line', async () => {
        const table = hold(
            await seatedAtCards(['explore', 'tax'], (state, { seat }) => {
                placeMarker(state, seat, emptySpaces(state, 'outpost')[0])
                buildFeudum(state, seat, emptySpaces(state, 'farm')[0])
                state.recomputeRanks()
                returnGoods(state, seat)
            })
        )
        const other = await table.host.openSeat(table.other)
        table.session.pressTurnCard('explore')
        flushSync()
        await table.session.sendTurnCard()
        await settled(table.session)
        await settled(other)
        expect(blockOf(other.actionPanel, 'backs')?.count).toBe(3)
        expect(linesOf(other.actionPanel, 'waiting')[0]).toContain('keeps 1')
    })

    it.each([
        [MachineState.PlayingCards, 'plays a card'],
        [MachineState.PlacingDisc, 'decides on a disc'],
        [MachineState.InspectingHarvest, 'takes favours'],
        [MachineState.DiscardingWrits, 'discards a writ']
    ])('%s reads "%s", naming the seat', async (machine, words) => {
        const table = hold(await atPlayingCards(['tax', 'move']))
        table.host.edit((state) => {
            state.machineState = machine
            state.activePlayerIds = [table.seat]
        })
        const other = await table.host.openSeat(table.other)
        await settled(other)
        const name = other.getPlayerName(table.seat)
        expect(linesOf(other.actionPanel, 'waiting')).toEqual([`${name} ${words}`])
    })
})

/** Every seat's view of a shared block: it reads the same for all. */
function sameForAll(sessions: readonly FeudumGameSession[]) {
    const [first, ...rest] = sessions.map((session) =>
        plain(sharedOf(session.actionPanel).filter(({ kind }) => kind === 'dawn-sheet'))
    )
    for (const other of rest) {
        expect(other).toEqual(first)
    }
    return first
}

function dawnOf(session: FeudumGameSession) {
    const sheet = blockOf(session.actionPanel, 'dawn-sheet')?.sheet
    assertExists(sheet, 'The action area shows the dawn sheet')
    return sheet
}

describe('S54 R-4.11, R-4.12 the progress line and the dawn sheet', () => {
    it('S54 every seat reads the sheet: ranks, landscapes, regions, disloyalty and total, from the Action', async () => {
        const table = hold(await playOutRound(2))
        const { session, sessions, host } = table
        const dawn = host.actions.find((action) => isBeginDawn(action))
        assertExists(dawn, 'The dawn played')
        expect(isBeginDawn(dawn) && dawn.metadata?.epoch).toBe(2)
        sameForAll(sessions)
        const sheet = dawnOf(session)
        expect(sheet.epoch).toBe(2)
        expect(sheet.rows.map(({ playerId }) => playerId)).toEqual(
            isBeginDawn(dawn) ? dawn.metadata?.sheet.map(({ playerId }) => playerId) : []
        )
        for (const row of sheet.rows) {
            const source = isBeginDawn(dawn)
                ? dawn.metadata?.sheet.find(({ playerId }) => playerId === row.playerId)
                : undefined
            expect(row).toMatchObject({
                ranks: source?.ranks,
                landscapes: source?.landscapes,
                activeRegions: source?.activeRegions,
                disloyaltyVp: source?.disloyaltyVp,
                total: source?.total
            })
        }
        expect(linesOf(session.actionPanel, 'round')).toContain('Epoch II dawns')
    })

    it('S54 the roll that takes a tile reads "Desert: tile II removed", to every seat', async () => {
        // No epoch change: the tile removed is whichever the die names.
        const table = hold(await playOutRound(undefined))
        const { host, sessions } = table
        const roll = host.actions.findLast((action) => isRollProgressDie(action))
        assertExists(roll, 'The round ended with a roll')
        const removed = isRollProgressDie(roll) ? roll.metadata?.removed : undefined
        assertExists(removed, 'R-4.11 With a stack showing, the fixed die takes a tile')
        const name = tileName(removed.tileId)
        const [region, epoch] = name.split(' ')
        const expected = `${region}: tile ${epoch} removed`
        for (const seat of sessions) {
            expect(linesOf(seat.actionPanel, 'round')).toContain(expected)
        }
    })

    it("R-4.12.4 the map's new goods and (III) the guild refill read on the sheet", async () => {
        const table = hold(await playOutRound(3))
        const sheet = dawnOf(table.session)
        expect(sheet.epoch).toBe(3)
        expect(sheet.notes.join()).toMatch(/new goods/i)
        expect(sheet.notes.join()).toMatch(/guilds refill/i)
    })

    it('R-4.12.3 the sheet stays through the collecting, with the order row over it', async () => {
        const table = hold(
            await playOutRound(2, (state, { seat, other }) => {
                tendLandscape(state, other, seat)
            })
        )
        const { session, sessions } = table
        expect(session.gameState.machineState).toBe(MachineState.CollectingLandscapes)
        expect(blockOf(session.actionPanel, 'order-row')?.step).toBe('landscapes')
        sameForAll(sessions)
        expect(dawnOf(session).fills.length).toBeGreaterThan(0)
        await primaryNamed(session.actionPanel, /^(Leave all|Collect)/).send()
        for (const seat of sessions) {
            await settled(seat)
        }
        flushSync()
        expect(session.gameState.machineState).toBe(MachineState.SelectingHands)
        sameForAll(sessions)
        dawnOf(session)
    })

    it('R-4.4-H5, R-4.12.3 a writ discarded at any time while a serf collects leaves the sheet standing', async () => {
        const table = hold(
            await playOutRound(2, (state, { seat, other }) => {
                tendLandscape(state, other, seat)
                holdWrit(state, other, AnyTimeWrit)
            })
        )
        const { session, sessions, host, other } = table
        expect(session.gameState.machineState).toBe(MachineState.CollectingLandscapes)
        const lines = linesOf(session.actionPanel, 'round')
        expect(dawnOf(session).epoch).toBe(2)

        await host.send(other, {
            type: ActionType.DiscardWrit,
            writId: AnyTimeWrit,
            ...DiscardAnyTime
        })
        for (const seat of sessions) {
            await settled(seat)
        }
        flushSync()
        expect(host.actions.at(-1)).toMatchObject({ type: ActionType.DiscardWrit, playerId: other })
        expect(session.gameState.machineState).toBe(MachineState.CollectingLandscapes)
        for (const seat of sessions) {
            expect(dawnOf(seat).epoch).toBe(2)
        }
        expect(linesOf(session.actionPanel, 'round')).toEqual(lines)
        sameForAll(sessions)
    })

    it('R-4.12 "until the next decision": the first press of the next round closes it, for every seat', async () => {
        const table = hold(await playOutRound(2))
        const { session, sessions, host } = table
        expect(session.gameState.machineState).toBe(MachineState.SelectingHands)
        const nextId = session.handPanel?.finaliseRow.find((entry) => entry.next)?.playerId
        const next = sessions.find((seat) => seat.myPlayerId === nextId)
        assertExists(next, 'A seat finalises next')
        const kinds = next.handPanel?.drafting?.cards.map(({ kind }) => kind) ?? []
        for (const seat of sessions) {
            dawnOf(seat)
        }
        for (const kind of kinds) {
            if (next.handPanel?.drafting?.primary.enabled) {
                break
            }
            next.toggleHandCard(kind)
            flushSync()
        }
        await next.finaliseHand()
        for (const seat of sessions) {
            await settled(seat)
        }
        flushSync()
        expect(host.actions.findLast(({ source }) => source === ActionSource.User)?.type).toBe(
            ActionType.FinaliseHand
        )
        for (const seat of sessions) {
            expect(blockOf(seat.actionPanel, 'dawn-sheet')).toBeUndefined()
            expect(linesOf(seat.actionPanel, 'round')).toEqual([])
        }
    })

    it('R-X.1 History View draws no sheet', async () => {
        const table = hold(await playOutRound(2))
        await table.session.history.goToPreviousAction()
        await settled(table.session)
        expect(table.session.roundEnd).toBeUndefined()
    })
})

describe('S56 R-6.2, R-6.3 the game-end summary', () => {
    const finalEpoch: TriggeredEpoch = 5

    it('S56 it replaces the panel for every seat, one column per seat, from ScoreGame', async () => {
        const table = hold(await playOutRound(finalEpoch))
        const { sessions, session, host } = table
        expect(session.gameState.machineState).toBe(MachineState.EndOfGame)
        const score = host.actions.find((action) => isScoreGame(action))
        assertExists(score, 'The game was scored')
        const first = plain(session.actionPanel)
        for (const seat of sessions) {
            expect(plain(seat.actionPanel)).toEqual(first)
            expect(seat.actionPanel.blocks.map(({ kind }) => kind)).toEqual(['game-end'])
        }
        const summary = blockOf(session.actionPanel, 'game-end')?.summary
        const rows = isScoreGame(score) ? score.metadata?.sheet : undefined
        assertExists(rows, 'ScoreGame carries the sheet')
        expect(summary?.columns.map(({ playerId }) => playerId)).toEqual(
            rows.map(({ playerId }) => playerId)
        )
        for (const column of summary?.columns ?? []) {
            const row = rows.find(({ playerId }) => playerId === column.playerId)
            expect(column.voyage.vp).toBe(row?.voyage.vp)
            expect(column.largeEmpire.vp).toBe(row?.largeEmpire.vp)
            expect(column.shillings.vp).toBe(row?.shillings.vp)
            expect(column.charters).toEqual(row?.charters)
            expect(column.score).toBe(row?.score)
            expect(column.fifthDawn).toBeTypeOf('number')
        }
        const winners = isScoreGame(score) ? score.metadata?.winners : []
        expect(
            summary?.columns.filter(({ winner }) => winner).map(({ playerId }) => playerId)
        ).toEqual(winners)
        expect(summary?.winnerLine).toMatch(/wins?$/)
    })

    it('S56 R-6.3 every column adds up to its total, with what was scored before the V dawn', async () => {
        const Banked = 11
        const table = hold(
            await playOutRound(finalEpoch, (state) => {
                for (const player of state.players) {
                    player.score += Banked
                }
            })
        )
        const summary = blockOf(table.session.actionPanel, 'game-end')?.summary
        assertExists(summary, 'The game was scored')
        for (const column of summary.columns) {
            const rows = [
                column.beforeDawn,
                column.fifthDawn,
                column.voyage.vp,
                column.largeEmpire.vp,
                column.shillings.vp,
                ...column.charters.map(({ vp }) => vp)
            ]
            expect(rows.reduce((sum, vp) => sum + vp, 0)).toBe(column.score)
            expect(column.beforeDawn).toBeGreaterThanOrEqual(Banked)
        }
    })

    it('S56 R-4.4.3 a charter held with a seal is sealed at the end, face up with its score, for every seat', async () => {
        const Sealed = 'writ.charter.monster-defeat'
        const table = hold(
            await playOutRound(finalEpoch, (state, { seat }) => {
                giveSeal(state, seat)
                holdWrit(state, seat, Sealed)
            })
        )
        for (const seat of table.sessions) {
            const summary = blockOf(seat.actionPanel, 'game-end')?.summary
            const column = summary?.columns.find(({ playerId }) => playerId === table.seat)
            expect(column?.charters.map(({ writId }) => writId)).toEqual([Sealed])
            expect(column?.charters[0].vp).toBeTypeOf('number')
        }
    })

    it('S56 R-6.3 the barrel that breaks a tie is named, and the winner is the fuller barrel', async () => {
        // A first table reads what each seat scores; the second starts each so that all three tie.
        const untied = await worldOf(
            () => playOutRound(finalEpoch),
            ({ host }) => {
                const final = host.actions.find((action) => isScoreGame(action))
                return isScoreGame(final) ? (final.metadata?.sheet ?? []) : []
            }
        )
        const best = Math.max(...untied.map(({ score }) => score))
        const table = hold(
            await playOutRound(finalEpoch, (state, { seat }) => {
                for (const { playerId, score } of untied) {
                    state.getPlayerState(playerId).score += best - score
                }
                fillBarrel(state, seat, 2)
            })
        )
        const score = table.host.actions.find((action) => isScoreGame(action))
        const metadata = isScoreGame(score) ? score.metadata : undefined
        assertExists(metadata?.barrelTieBreak, 'The vp were tied')
        const name = table.session.getPlayerName(table.seat)
        const barrel = metadata.barrelTieBreak.find(({ playerId }) => playerId === table.seat)
        expect(barrel?.barrel).toBeGreaterThan(0)
        for (const seat of table.sessions) {
            const summary = blockOf(seat.actionPanel, 'game-end')?.summary
            expect(summary?.tieBreak).toMatch(/^Tie on vp broken by barrel sulfur: /)
            expect(summary?.tieBreak).toContain(`${name} ${barrel?.barrel}`)
            expect(summary?.winnerLine).toBe(`${name} wins`)
        }
    })
})
