import {
    ruleFarm,
    setBeads,
    setMarket,
    setRowMarkers,
    setScrolls,
    setShillings,
    setVesselsForSale
} from '@tabletop/feudum/testing'
import { flushSync } from 'svelte'
import { assertExists, type GameAction } from '@tabletop/common'
import type { GuildFunctionName, GuildId } from '@tabletop/feudum'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
    type GuildArrange,
    type GuildTable,
    guildTable,
    seatRowIndex
} from '$lib/testing/guildTable.js'
import { settled, type FeudumHost } from '$lib/testing/sessionHarness.js'
import { emptySpace } from '$lib/testing/turnTable.js'
import { guildTarget } from './boardOffer.js'
import type { PanelChoice } from './cardFlows.js'
import type { FeudumGameSession } from './session.svelte.js'
import { tradePickerOf, type TradeCard, type TradePicker } from './tradePicker.js'

let host: FeudumHost | undefined

beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined)
})

afterEach(() => {
    host?.close()
    host = undefined
    vi.restoreAllMocks()
})

async function press(session: FeudumGameSession, choice: PanelChoice): Promise<void> {
    await session.pressTurnChoice(choice)
    flushSync()
    await settled(session)
}

/** The Guild card, the guild's area unless it is the lone one, then its function's row. */
async function opened(
    arrange: GuildArrange,
    guildId: GuildId,
    fn: GuildFunctionName = 'trade'
): Promise<GuildTable> {
    const turn = await guildTable(arrange)
    host = turn.host
    flushSync()
    const { session } = turn
    session.pressTurnCard('guild')
    flushSync()
    if (session.guild.value('guild') !== guildId) {
        await session.pressTurnTarget(guildTarget(guildId))
        flushSync()
        await settled(session)
    }
    const word = new RegExp(`^${fn.charAt(0).toUpperCase()}${fn.slice(1)}`)
    const row = session.guildPanel?.popup?.choices.find(({ label }) => word.test(label))
    assertExists(row, `A ${fn} row`)
    await press(session, row)
    return turn
}

function pickerOf({ session, seat }: GuildTable): TradePicker | undefined {
    const bench = session.guildPanel?.bench
    assertExists(bench, 'The bench is open')
    return tradePickerOf(bench, session.gameState, seat)
}

function picker(turn: GuildTable): TradePicker {
    const read = pickerOf(turn)
    assertExists(read, 'The trade picker reads the bench')
    return read
}

function card(read: TradePicker, name: string): TradeCard {
    const found = read.cards.find((each) => each.name === name)
    assertExists(found, `No card ${name} in ${read.cards.map((each) => each.name).join()}`)
    return found
}

function sentBy({ host: tableHost, seat }: GuildTable): readonly GameAction[] {
    return tableHost.sent.get(seat) ?? []
}

describe('Contract, The trade picker: each offer a choice card', () => {
    it('R-4.6.2 an Alchemist trade: one card per vessel for sale, its Buy sends that vessel', async () => {
        const turn = await opened((state, { seat }) => {
            setVesselsForSale(state, ['ship', 'submersible'])
            setShillings(state, seat, 9)
        }, 'alchemist')
        const read = picker(turn)
        expect(read.title).toBe('Alchemist trade')
        expect(read.line).toBe('Buy 1')
        expect(read.purse).toBe(9)
        expect(read.sends).toBe('each')
        expect(read.basket).toBeUndefined()
        const ship = card(read, 'Ship')
        expect(ship.gain).toEqual([{ kind: 'vessel', vessel: 'ship' }])
        expect(ship.label).toBe(`Ship: ${ship.price}s → ship`)
        expect(ship.press).toMatchObject({
            label: `Buy ship · ${ship.price}s`,
            shown: 'Buy'
        })
        expect(read.cards.map(({ name, words }) => [name, words])).toEqual([
            ['Ship', undefined],
            ['Submersible', undefined]
        ])

        assertExists(ship.press, 'Buy takes a press')
        await press(turn.session, ship.press)
        expect(sentBy(turn)[0]).toMatchObject({
            guildId: 'alchemist',
            fn: 'trade',
            params: { vesselType: 'ship' }
        })
    })

    it('R-4.6.3 a Knight trade: one card for the row’s markers, priced, its full words its name', async () => {
        const turn = await opened((state, { seat }) => {
            const markers = [0, 0, 0, 0]
            markers[seatRowIndex(state, seat)] = 2
            setRowMarkers(state, markers)
            setShillings(state, seat, 9)
        }, 'knight')
        const read = picker(turn)
        const [only] = read.cards
        expect(read.cards).toHaveLength(1)
        expect(read.line).toBe('Take row')
        expect(only?.label).toBe("Your row's markers: 3s → 2 markers")
        expect([only?.name, only?.words]).toEqual(['Your row', 'take 2'])
        expect(only?.gain).toHaveLength(2)
        expect(only?.press).toMatchObject({ label: 'Buy 2 markers · 3s', shown: 'Buy' })
    })

    it('R-4.6.3, R-4.6-H2 a Monk trade: one card naming both beads; the send is the primary', async () => {
        const turn = await opened((state, { seat }) => {
            setBeads(state, { rosary: [5, 2], chickens: [] })
            setShillings(state, seat, 9)
        }, 'monk')
        const read = picker(turn)
        expect(read.sends).toBe('one')
        expect(read.cards.map(({ label, press: buy }) => [label, buy])).toEqual([
            [expect.stringMatching(/^Draw a bead: \d+s → bead 5 or 2$/), undefined]
        ])
        expect(read.line).toBe('Draw 1 of 2')
        expect(read.cards[0]?.words).toBe("can't be undone")
    })

    it('R-4.6.3 a Farmer trade keeps the bench and its map pick', async () => {
        const turn = await opened((state, { seat }) => {
            ruleFarm(state, seat, emptySpace(state, 'farm'), { food: 4 })
            ruleFarm(state, seat, emptySpace(state, 'farm'), { wood: 4 })
        }, 'farmer')
        expect(pickerOf(turn)).toBeUndefined()
    })
})

describe('Contract, The trade picker: picks that add up stand in a basket', () => {
    it('R-4.6.2 a Merchant basket: each bin at its next price, a running total, one send', async () => {
        const turn = await opened((state, { seat }) => {
            setMarket(state, { iron: 4, wood: 2 })
            setShillings(state, seat, 30)
        }, 'merchant')
        const before = picker(turn)
        expect(before.sends).toBe('one')
        expect(before.line).toBe('Buy up to 3')
        expect(before.basket).toEqual({ picks: [], total: 0, most: 3 })
        const iron = card(before, 'Iron')
        expect(iron.stock).toBe('4 in bin')
        expect(iron.label).toBe(`Iron: ${iron.price}s → iron`)
        assertExists(iron.press, 'A bin takes a press')
        await press(turn.session, iron.press)
        const second = card(picker(turn), 'Iron').press
        assertExists(second, 'The bin takes a second press')
        await press(turn.session, second)

        const after = picker(turn)
        expect(after.basket?.picks).toEqual([
            { kind: 'good', good: 'iron' },
            { kind: 'good', good: 'iron' }
        ])
        expect(card(after, 'Iron').stock).toBe('2 bought')
        const total = after.basket?.total ?? 0
        expect(total).toBeGreaterThan(0)
        expect(turn.session.guildPanel?.primary?.label).toBe(`Buy 2 goods · ${total}s`)
        expect(sentBy(turn)).toEqual([])
    })

    it('R-4.6.3, R-4.10.2 a Merchant basket holding sulfur offers it into the barrel, and the send carries it', async () => {
        const turn = await opened((state, { seat }) => {
            setMarket(state, { sulfur: 3 })
            setShillings(state, seat, 30)
        }, 'merchant')
        const sulfur = card(picker(turn), 'Sulfur').press
        assertExists(sulfur, 'The sulfur bin takes a press')
        await press(turn.session, sulfur)

        const benchRows = () => turn.session.guildPanel?.bench?.rows ?? []
        const choices = benchRows()
        expect(choices.map(({ label, picked }) => [label, picked])).toEqual([
            ['Keep it', true],
            ['Into the barrel: 1', false]
        ])
        const barrel = choices.find(({ label }) => label === 'Into the barrel: 1')
        assertExists(barrel, 'The barrel choice')
        await press(turn.session, barrel)
        expect(benchRows().find(({ picked }) => picked)?.label).toBe('Into the barrel: 1')
        await turn.session.sendTurnCard()
        await settled(turn.session)
        expect(JSON.stringify(sentBy(turn))).toContain('"sulfurToBarrel":1')
    })

    it('R-3.3 a sulfur pouch still offers the second card beside a trade picker, before its Buy sends', async () => {
        const turn = await opened((state, { seat }) => {
            setVesselsForSale(state, ['ship'])
            setShillings(state, seat, 30)
            state.getPlayerState(seat).pouch = 'sulfur'
        }, 'alchemist')
        const tray = turn.session.actionPanel.blocks.filter(({ stands }) => stands === 'tray')
        const names = tray.map((block) => (block.kind === 'rows' ? block.name : block.kind))
        expect(names).toContain('trade-picker')
        expect(names.indexOf('second')).toBeGreaterThanOrEqual(0)
        expect(names.indexOf('second')).toBeLessThan(names.indexOf('trade-picker'))
    })

    it('Contract, The trade picker: the control row, the second card then Forfeit, heads the tray and the picker ends it', async () => {
        const turn = await opened((state, { seat }) => {
            setVesselsForSale(state, ['ship'])
            setShillings(state, seat, 30)
            state.getPlayerState(seat).pouch = 'sulfur'
        }, 'alchemist')
        const tray = turn.session.actionPanel.blocks.filter(({ stands }) => stands === 'tray')
        const names = tray.map((block) => (block.kind === 'rows' ? block.name : block.kind))
        expect(names).toEqual(['second', 'card', 'trade-picker'])
    })

    it('R-4.6-H1 a Noble basket: a card per seal on the scrolls, each its scroll space', async () => {
        const turn = await opened((state, { seat }) => {
            setScrolls(state, ['guild.noble.scroll.r1c1', 'guild.noble.scroll.r1c3'])
            setShillings(state, seat, 9)
        }, 'noble')
        const read = picker(turn)
        expect(read.line).toBe('Buy up to 2 · 3s each')
        expect(read.cards.map(({ label }) => label)).toEqual([
            "Seal row 1, space 1: 3s → king's seal",
            "Seal row 1, space 3: 3s → king's seal"
        ])
        expect(read.cards.map(({ words }) => words)).toEqual([undefined, undefined])
        const [first] = read.cards
        assertExists(first?.press, 'A seal takes a press')
        await press(turn.session, first.press)
        expect(picker(turn).basket).toMatchObject({ picks: [{ kind: 'seal' }], total: 3 })
        expect(turn.session.guildPanel?.primary?.label).toBe('Buy 1 seal · 3s')
    })
})
