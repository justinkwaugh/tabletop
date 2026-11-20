import { flushSync } from 'svelte'
import { assertExists, type GameAction } from '@tabletop/common'
import {
    ActionType,
    KnightRowIds,
    knightRows,
    Seals,
    type GuildFunctionName,
    type GuildFunctionParams,
    type GuildId,
    type HydratedFeudumGameState,
    type SpaceId
} from '@tabletop/feudum'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
    guildTable,
    ruleFarm,
    seatRowIndex,
    setBarn,
    setBeads,
    setCarts,
    setJourneyman,
    setMarket,
    setMaster,
    setPawns,
    setRowMarkers,
    setScrolls,
    setShillings,
    setVesselsForSale,
    StandingSpace,
    type GuildArrange,
    type GuildSeats,
    type GuildTable
} from '$lib/testing/guildTable.js'
import { settled, type FeudumHost } from '$lib/testing/sessionHarness.js'
import { giveTile, ruleTown } from '$lib/testing/turnTable.js'
import type { BenchChoice, BenchItem, BenchOffer } from './benchOffer.js'
import { guildTarget, spaceTarget, type BoardTarget } from './boardOffer.js'
import type { PanelChoice } from './cardFlows.js'
import { GuildStageOrder, type GuildDraftValues } from './guildDraft.svelte.js'
import type { FeudumGameSession } from './session.svelte.js'
import { StagedDraft } from './stagedDraft.svelte.js'

const R1C1 = 'guild.noble.scroll.r1c1'
const R1C2 = 'guild.noble.scroll.r1c2'
const R1C3 = 'guild.noble.scroll.r1c3'
const AllCarts = { wood: 3, iron: 3, food: 3, sulfur: 3, saltpeter: 3 }
const SecondSpace: SpaceId = 'space.desert.1'

let host: FeudumHost | undefined

beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined)
})

afterEach(() => {
    host?.close()
    host = undefined
    vi.restoreAllMocks()
})

async function table(arrange: GuildArrange): Promise<GuildTable> {
    const turn = await guildTable(arrange)
    host = turn.host
    flushSync()
    return turn
}

function sentBy({ host: tableHost, seat }: GuildTable): readonly GameAction[] {
    return tableHost.sent.get(seat) ?? []
}

function pickCard(session: FeudumGameSession): void {
    session.pressTurnCard('guild')
    flushSync()
}

async function pressChoice(session: FeudumGameSession, choice: PanelChoice): Promise<void> {
    await session.pressTurnChoice(choice)
    flushSync()
    await settled(session)
}

async function pressTarget(session: FeudumGameSession, target: BoardTarget): Promise<void> {
    await session.pressTurnTarget(target)
    flushSync()
    await settled(session)
}

async function undo(session: FeudumGameSession): Promise<void> {
    await session.undo()
    await settled(session)
}

function popupRow(session: FeudumGameSession, label: RegExp): PanelChoice {
    const rows = session.guildPanel?.popup?.choices ?? []
    const row = rows.find((choice) => label.test(choice.label))
    assertExists(row, `No popup row ${String(label)} in ${rows.map((c) => c.label).join()}`)
    return row
}

function benchOf(session: FeudumGameSession): BenchOffer {
    const bench = session.guildPanel?.bench
    assertExists(bench, 'The bench is open')
    return bench
}

function itemOf(session: FeudumGameSession, id: string): BenchItem {
    const { items } = benchOf(session)
    const item = items.find((row) => row.id === id)
    assertExists(item, `No item ${id} in ${items.map((row) => row.id).join()}`)
    return item
}

async function pressItem(session: FeudumGameSession, id: string): Promise<void> {
    await pressChoice(session, itemOf(session, id))
}

const FunctionWords: Readonly<Record<GuildFunctionName, RegExp>> = {
    trade: /^Trade/,
    pull: /^Pull/,
    push: /^Push/
}

/** The card, then the guild's area unless it is the lone one, then its function's popup row. */
async function openFunction(
    session: FeudumGameSession,
    guildId: GuildId,
    fn: GuildFunctionName
): Promise<void> {
    pickCard(session)
    if (session.guild.value('guild') !== guildId) {
        await pressTarget(session, guildTarget(guildId))
    }
    await pressChoice(session, popupRow(session, FunctionWords[fn]))
}

/** One press past the function's own opening. */
type BenchPress = { readonly item: string } | { readonly map: 'first' } | { readonly popup: RegExp }

async function pressAll(session: FeudumGameSession, presses: readonly BenchPress[]): Promise<void> {
    for (const press of presses) {
        if ('item' in press) {
            await pressItem(session, press.item)
        } else if ('popup' in press) {
            await pressChoice(session, popupRow(session, press.popup))
        } else {
            const target = benchOf(session).map?.at(0)?.target
            assertExists(target, 'The map offers a pick')
            await pressTarget(session, target)
        }
    }
}

interface Family {
    readonly guildId: GuildId
    readonly fn: GuildFunctionName
    readonly arrange: (state: HydratedFeudumGameState, seats: GuildSeats) => void
    readonly presses: readonly BenchPress[]
    readonly params: GuildFunctionParams
    /** The last press finishes it: every stage manual, nothing revealed, so it sends. */
    readonly sends?: true
}

const good = (kind: string): BenchPress => ({ item: `good:${kind}` })
const scroll = (spaceId: string): BenchPress => ({ item: `scroll:${spaceId}` })
const row = (index: number): BenchPress => ({ item: `row:${KnightRowIds[index]}` })

/** R-4.6, each function of each guild: its arrangement, its presses and what they send. */
const Families: readonly Family[] = [
    {
        guildId: 'farmer',
        fn: 'trade',
        arrange: (state, { seat }) => {
            ruleFarm(state, seat, { food: 4 })
            ruleFarm(state, seat, { food: 4 })
        },
        presses: [{ map: 'first' }, { popup: /^4 sent: 0 food/ }],
        params: { takeFood: 0 },
        sends: true
    },
    {
        guildId: 'farmer',
        fn: 'pull',
        arrange: (state, { seat, other }) => {
            setJourneyman(state, seat, 'farmer', other)
            setBeads(state, { rosary: [5, 2], chickens: [3] })
        },
        presses: [],
        params: {}
    },
    {
        guildId: 'farmer',
        fn: 'push',
        arrange: (state, { seat }) => {
            setMaster(state, seat, 'farmer')
            setBarn(state, { iron: 2 })
        },
        presses: [good('iron'), good('iron')],
        params: { goods: ['iron', 'iron'] }
    },
    {
        guildId: 'merchant',
        fn: 'trade',
        arrange: (state, { seat }) => {
            setMarket(state, { iron: 4 })
            setShillings(state, seat, 30)
        },
        presses: [good('iron'), good('iron')],
        params: { goods: ['iron', 'iron'] }
    },
    {
        guildId: 'merchant',
        fn: 'pull',
        arrange: (state, { seat, other }) => {
            setJourneyman(state, seat, 'merchant', other)
            setBarn(state, { iron: 2 })
        },
        presses: [good('iron'), good('iron')],
        params: { goods: ['iron', 'iron'] }
    },
    {
        guildId: 'merchant',
        fn: 'push',
        arrange: (state, { seat }) => {
            setMaster(state, seat, 'merchant')
            setMarket(state, { wood: 2 })
        },
        presses: [good('wood'), good('wood')],
        params: { goods: ['wood', 'wood'] }
    },
    {
        guildId: 'alchemist',
        fn: 'trade',
        arrange: (state, { seat }) => {
            setVesselsForSale(state, ['ship', 'submersible'])
            setShillings(state, seat, 9)
        },
        presses: [{ item: 'vessel:ship' }],
        params: { vesselType: 'ship' },
        sends: true
    },
    {
        guildId: 'alchemist',
        fn: 'pull',
        arrange: (state, { seat, other }) => {
            setJourneyman(state, seat, 'alchemist', other)
            setMarket(state, { wood: 2 })
        },
        presses: [good('wood'), good('wood')],
        params: { goods: ['wood', 'wood'] }
    },
    {
        guildId: 'alchemist',
        fn: 'push',
        arrange: (state, { seat }) => {
            setMaster(state, seat, 'alchemist')
            setCarts(state, AllCarts)
        },
        presses: [{ item: 'invention:ship' }, { item: 'invention:submersible' }],
        params: { inventions: ['ship', 'submersible'] }
    },
    {
        guildId: 'knight',
        fn: 'trade',
        arrange: (state, { seat }) => {
            const markers = [0, 0, 0, 0]
            markers[seatRowIndex(state, seat)] = 1
            setRowMarkers(state, markers)
            setShillings(state, seat, 9)
        },
        presses: [{ item: 'row:seat' }],
        params: {},
        sends: true
    },
    {
        guildId: 'knight',
        fn: 'pull',
        arrange: (state, { seat, other }) => {
            setJourneyman(state, seat, 'knight', other)
            setCarts(state, AllCarts)
        },
        presses: [{ item: 'invention:ship' }],
        params: { inventions: ['ship'] }
    },
    {
        guildId: 'knight',
        fn: 'push',
        arrange: (state, { seat }) => {
            setMaster(state, seat, 'knight')
            setRowMarkers(state, [1, 1, 1])
        },
        presses: [row(0), scroll(R1C1)],
        params: { knightRows: ['knight-row-1'], scrollSpaces: [R1C1] }
    },
    {
        guildId: 'noble',
        fn: 'trade',
        arrange: (state, { seat }) => {
            setScrolls(state, [R1C1, R1C2])
            setShillings(state, seat, 9)
        },
        presses: [scroll(R1C1), scroll(R1C2)],
        params: { scrollSpaces: [R1C1, R1C2] }
    },
    {
        guildId: 'noble',
        fn: 'pull',
        arrange: (state, { seat, other }) => {
            setJourneyman(state, seat, 'noble', other)
            setRowMarkers(state, [1, 1])
        },
        presses: [row(0), row(1), scroll(R1C1), scroll(R1C2)],
        params: { knightRows: ['knight-row-1', 'knight-row-2'], scrollSpaces: [R1C1, R1C2] },
        sends: true
    },
    {
        guildId: 'noble',
        fn: 'push',
        arrange: (state, { seat }) => {
            setMaster(state, seat, 'noble')
            setScrolls(state, [R1C1, R1C2])
        },
        presses: [scroll(R1C1), scroll(R1C2)],
        params: { scrollSpaces: [R1C1, R1C2] }
    },
    {
        guildId: 'monk',
        fn: 'trade',
        arrange: (state, { seat }) => {
            setBeads(state, { rosary: [5, 2], chickens: [] })
            setShillings(state, seat, 9)
        },
        presses: [],
        params: {}
    },
    {
        guildId: 'monk',
        fn: 'pull',
        arrange: (state, { seat, other }) => {
            setJourneyman(state, seat, 'monk', other)
            setScrolls(state, [R1C1, R1C2])
        },
        presses: [scroll(R1C2)],
        params: { scrollSpaces: [R1C2] }
    },
    {
        guildId: 'monk',
        fn: 'push',
        arrange: (state, { seat }) => {
            setMaster(state, seat, 'monk')
            setBeads(state, { rosary: [5, 2], chickens: [] })
        },
        presses: [],
        params: {}
    }
]

const familyName = ({ guildId, fn }: Family) => `${guildId} ${fn}`

/** The presses that stage and send nothing. */
const stagingPresses = ({ presses, sends }: Family) => (sends ? presses.slice(0, -1) : presses)

/** R-3.16, R-4.6 Nothing else open, so a family's own stages are all a spec sees. */
async function atBench(family: Family) {
    const turn = await table(family.arrange)
    await openFunction(turn.session, family.guildId, family.fn)
    return turn
}

/** The primary, unless the last press already sent. */
async function finish(turn: GuildTable): Promise<void> {
    if (sentBy(turn).length === 0) {
        expect(turn.session.guildPanel?.primary?.enabled).toBe(true)
        await turn.session.sendTurnCard()
        await settled(turn.session)
    }
}

describe.each(Families.map((family) => [familyName(family), family] as const))(
    'R-3.16, R-4.6 %s: the minimum tests',
    (_name, family) => {
        const { guildId, fn, presses, params } = family
        const firstPress = stagingPresses(family).slice(0, 1)

        it('1 setting a stage clears every later one', async () => {
            const turn = await atBench(family)
            const { session } = turn
            expect(session.guild.value('fn')).toBe(fn)
            await pressAll(session, firstPress)

            session.guild.set('guild', guildId)
            flushSync()
            expect(session.guild.value('fn')).toBeUndefined()
            expect(session.guild.value('picks')).toBeUndefined()
            expect(session.guild.value('farm')).toBeUndefined()
            expect(session.guild.value('take')).toBeUndefined()
            expect(session.guildPanel?.stage).toBe('function')
        })

        it('2 Undo with a manual stage pops the highest, and undoes no Action', async () => {
            const turn = await atBench(family)
            const { session } = turn
            await pressAll(session, firstPress)
            await undo(session)
            expect(session.guild.value('picks') ?? []).toEqual([])
            expect(session.guild.value('take')).toBeUndefined()
            expect(session.guild.value('farm')).toBeUndefined()
            expect(session.guild.value('fn')).toBe(firstPress.length > 0 ? fn : undefined)
            expect(sentBy(turn)).toEqual([])
            expect(session.turn.value('card')).toBe('guild')
        })

        it('3 Undo with only auto stages goes on past this draft', async () => {
            const turn = await table(family.arrange)
            const { session } = turn
            pickCard(session)
            session.guild.set('guild', guildId, 'auto')
            flushSync()
            expect(session.guild.hasManual).toBe(false)
            expect(session.guild.localSelection.undo()).toBe(false)

            await undo(session)
            expect(session.turn.value('card')).toBeUndefined()
            expect(session.guildPanel).toBeUndefined()
            expect(sentBy(turn)).toEqual([])
        })

        it('4 a stage the order lacks throws', () => {
            const lacking = new StagedDraft<GuildDraftValues>(
                GuildStageOrder.filter((stage) => stage !== 'fn')
            )
            expect(() => {
                lacking.set('fn', fn)
            }).toThrow(/does not exist in stage order/)
        })

        it('5 the card pressed again ends the draft', async () => {
            const turn = await atBench(family)
            const { session } = turn
            await pressAll(session, firstPress)
            pickCard(session)
            expect(session.guild.selection).toEqual({})
            expect(session.guildPanel).toBeUndefined()
            expect(sentBy(turn)).toEqual([])
        })

        it('sends what was staged, by the logic’s own check', async () => {
            const turn = await atBench(family)
            await pressAll(turn.session, presses)
            await finish(turn)
            const [sent] = sentBy(turn)
            expect(sent).toMatchObject({
                type: ActionType.GuildAction,
                guildId,
                fn,
                params: expect.objectContaining(params)
            })
        })
    }
)

const Stacked = Families.filter(
    (family) =>
        stagingPresses(family).length >= 2 && family.presses.every((press) => 'item' in press)
)

describe.each(Stacked.map((family) => [familyName(family), family] as const))(
    'R-4.6.1 %s: the stacked picks',
    (_name, family) => {
        it('6 Undo pops the latest press and keeps the earlier', async () => {
            const { session } = await atBench(family)
            const pressed = stagingPresses(family)
            await pressAll(session, pressed)
            const staged = session.guild.value('picks') ?? []
            expect(staged).toHaveLength(pressed.length)
            await undo(session)
            expect(session.guild.value('picks')).toEqual(staged.slice(0, -1))
            expect(session.guild.value('fn')).toBe(family.fn)
        })

        it('7 a push clears every later stage, and Undo pops an open later stage first', async () => {
            const { session } = await atBench(family)
            await pressAll(session, family.presses.slice(0, 1))
            session.guild.set('count', 'rows')
            flushSync()
            const before = session.guild.value('picks')
            await undo(session)
            expect(session.guild.value('count')).toBeUndefined()
            expect(session.guild.value('picks')).toEqual(before)

            session.guild.set('count', 'rows')
            await pressAll(session, family.presses.slice(1, 2))
            expect(session.guild.entry('count')?.source).not.toBe('manual')
        })
    }
)

describe('R-X.2 8 the keep rule: the draft ends with the displayed state', () => {
    it('on a reconciliation, an Action sent elsewhere, and the seat’s own', async () => {
        const merchant = Families.find(({ guildId, fn }) => guildId === 'merchant' && fn === 'pull')
        assertExists(merchant, 'The table holds a Merchant pull')
        const turn = await table((state, seats) => {
            merchant.arrange(state, seats)
            giveTile(state, seats.seat)
            giveTile(state, seats.seat)
        })
        const { session, seat, host: tableHost } = turn
        const stage = async () => {
            expect(session.guild.selection).toEqual({})
            await openFunction(session, 'merchant', 'pull')
            await pressAll(session, merchant.presses.slice(0, 1))
            expect(session.guild.value('picks')).toHaveLength(1)
        }
        const spend = () => ({
            type: ActionType.SpendRegionTile,
            tileId: session.gameState.getPlayerState(seat).regionTiles[0],
            good: 'food'
        })

        await stage()
        tableHost.sendUnheard(seat, spend())
        await tableHost.reconcile(seat)
        await settled(session)
        expect(session.guild.selection).toEqual({})

        await stage()
        await tableHost.send(seat, spend())
        await settled(session)
        expect(session.guild.selection).toEqual({})

        await stage()
        await session.forfeitTurnCard()
        await settled(session)
        expect(session.guild.selection).toEqual({})
    })
})

describe('S40 R-3.16 a guild, then its function', () => {
    async function opened() {
        const turn = await table((state, { seat, other }) => {
            setJourneyman(state, seat, 'merchant', other)
            setBarn(state, { iron: 2, wood: 1 })
            setMarket(state, { saltpeter: 3, sulfur: 3, iron: 1, wood: 3, food: 3 })
            setCarts(state, AllCarts)
            setVesselsForSale(state, ['ship'])
            setShillings(state, seat, 9)
            state.getPlayerState(seat).guildsUsed = ['noble']
        })
        pickCard(turn.session)
        return turn
    }

    it('R-3.16 lights what can be done; a used guild stays unlit', async () => {
        const { session } = await opened()
        expect(session.guildPanel?.stage).toBe('guild')
        const targets = session.guild.pick?.targets ?? []
        const lit = targets.filter(({ unlit }) => !unlit).map(({ target }) => target)
        expect(lit).toContain(guildTarget('merchant'))
        expect(lit).toContain(guildTarget('alchemist'))
        expect(lit).not.toContain(guildTarget('noble'))
        expect(targets.find(({ target }) => target === guildTarget('noble'))?.unlit).toBe(true)
        await pressTarget(session, guildTarget('noble'))
        expect(session.guild.value('guild')).toBeUndefined()
    })

    it('R-3.16.1 the popup: each open function with its cost and best outcome; a closed one is not drawn', async () => {
        const { session } = await opened()
        await pressTarget(session, guildTarget('merchant'))
        const { popup } = session.guildPanel ?? {}
        expect(popup?.anchor).toBe(guildTarget('merchant'))
        expect(popup?.choices.some(({ label }) => label.startsWith('Push'))).toBe(false)
        const trade = popupRow(session, /^Trade/)
        expect(trade.note?.kind).toBe('cost')
        expect(trade.note?.label).toMatch(/^from \ds$/)
        expect(popupRow(session, /^Pull/).label).toMatch(/^Pull · up to \d+ vp$/)
    })

    it('S62 Undo closes the popup, then the card', async () => {
        const { session } = await opened()
        await pressTarget(session, guildTarget('merchant'))
        await undo(session)
        expect(session.guildPanel?.stage).toBe('guild')
        expect(session.guildPanel?.popup).toBeUndefined()
        await undo(session)
        expect(session.turn.value('card')).toBeUndefined()
    })

    it('a press outside the open popup does nothing', async () => {
        const { session } = await opened()
        await pressTarget(session, guildTarget('merchant'))
        await pressTarget(session, guildTarget('alchemist'))
        expect(session.guild.value('guild')).toBe('merchant')
    })

    it('R-4.6.3 a function’s press opens the bench, its areas from-guild left, to-guild right', async () => {
        const { session } = await opened()
        await pressTarget(session, guildTarget('merchant'))
        await pressChoice(session, popupRow(session, /^Pull/))
        expect(session.guildPanel?.stage).toBe('bench')
        expect(benchOf(session).areas).toEqual(['farmer', 'merchant'])
    })
})

describe('S41 R-4.6.4 a Merchant pull with both counts', () => {
    async function pulled() {
        const turn = await table((state, { seat, other }) => {
            setJourneyman(state, seat, 'merchant', other)
            setBarn(state, { iron: 2, wood: 1 })
            setMarket(state, { saltpeter: 3, sulfur: 3, iron: 1, wood: 3, food: 3 })
        })
        await openFunction(turn.session, 'merchant', 'pull')
        await pressAll(turn.session, [good('iron'), good('iron'), good('wood')])
        return turn
    }

    it('R-4.6.4 one row, two columns: the higher is preselected, and there is nothing to set', async () => {
        const { session } = await pulled()
        const { count, result, primary } = benchOf(session)
        expect(result?.moved).toBe('3 goods · 1 row, 2 columns')
        expect(result?.line).toBe("3 vp · 2 writs, keep 1 · can't be undone")
        expect(count?.map(({ label, picked }) => [label, picked])).toEqual([
            ['Rows (1)', false],
            ['Columns (2)', true]
        ])
        expect(count?.every(({ press }: BenchChoice) => press === undefined)).toBe(true)
        expect(primary).toEqual({ label: "Move 3 goods · can't be undone", enabled: true })
    })

    it('R-X.2 it reveals writs, so it waits for the primary; Undo takes back the last good', async () => {
        const turn = await pulled()
        const { session } = turn
        expect(sentBy(turn)).toEqual([])
        await undo(session)
        expect(session.guild.value('picks')).toEqual([
            { kind: 'good', good: 'iron' },
            { kind: 'good', good: 'iron' }
        ])
        await pressItem(session, 'good:wood')
        await session.sendTurnCard()
        await settled(session)
        expect(sentBy(turn)[0]).toMatchObject({
            type: ActionType.GuildAction,
            params: { goods: ['iron', 'iron', 'wood'] }
        })
        expect(sentBy(turn)[0]).not.toHaveProperty('params.count')
    })
})

describe('S41 R-4.6.5 a Farmer push and a Knight push set their count', () => {
    it('R-4.6.5 Farmer push: the higher as auto, the lower by a press, and it sends', async () => {
        const turn = await table((state, { seat }) => {
            setMaster(state, seat, 'farmer')
            setBarn(state, { iron: 2, wood: 1 })
            setMarket(state, { saltpeter: 3, sulfur: 3, iron: 1, wood: 3, food: 3 })
        })
        const { session } = turn
        await openFunction(session, 'farmer', 'push')
        await pressAll(session, [good('iron'), good('iron'), good('wood')])
        expect(session.guild.entry('count')).toEqual({ value: 'columns', source: 'auto' })
        expect(benchOf(session).result?.line).toBe('5 vp')

        const rows = benchOf(session).count?.at(0)
        assertExists(rows, 'The toggle offers rows')
        await pressChoice(session, rows)
        expect(session.guild.entry('count')?.source).toBe('manual')
        expect(benchOf(session).result?.line).toBe('4 vp')

        await session.sendTurnCard()
        await settled(session)
        expect(sentBy(turn)[0]).toMatchObject({ params: { count: 'rows' } })
    })
})

describe('R-4.6.1 the bench over the board', () => {
    const merchantPull = (state: HydratedFeudumGameState, { seat, other }: GuildSeats) => {
        setJourneyman(state, seat, 'merchant', other)
        setBarn(state, { iron: 2, wood: 1 })
    }

    it('R-4.6.1 while it is open it covers the board’s guild areas, and a press on one does nothing', async () => {
        const { session } = await table(merchantPull)
        expect(session.benchCovers).toBe(false)
        await openFunction(session, 'merchant', 'pull')
        expect(session.benchCovers).toBe(true)
        await session.pressBoardTarget(guildTarget('farmer'))
        await session.pressBoardTarget(guildTarget('merchant'))
        flushSync()
        expect(session.guild.value('guild')).toBe('merchant')
        expect(session.guild.value('fn')).toBe('pull')
        expect(benchOf(session).title).toBe('Merchant pull')
    })

    it('R-4.6.3 at its header for a map pick it covers nothing, and a guild area still takes no press', async () => {
        const { session } = await table((state, { seat }) => {
            ruleFarm(state, seat, { food: 4 })
            ruleFarm(state, seat, { wood: 4 })
        })
        await openFunction(session, 'farmer', 'trade')
        expect(session.benchCovers).toBe(false)
        await session.pressBoardTarget(guildTarget('merchant'))
        flushSync()
        expect(session.guild.value('guild')).toBe('farmer')
        expect(benchOf(session).collapsed).toBe('Pick a farm.')
    })

    it('R-4.6.3 a farm’s split keeps it at its header: the popup stands on the map', async () => {
        const { session } = await table((state, { seat }) => {
            ruleFarm(state, seat, { food: 4 })
            ruleFarm(state, seat, { wood: 4 })
        })
        await openFunction(session, 'farmer', 'trade')
        const target = benchOf(session).map?.at(0)?.target
        assertExists(target, 'A farm is lit')
        await pressTarget(session, target)
        expect(benchOf(session).collapsed).toBe('Split.')
        expect(session.benchCovers).toBe(false)
    })
})

describe('S42 R-4.6.4 a pull that completes nothing', () => {
    it('R-4.6.4 no writ, and the primary carries no warning', async () => {
        const turn = await table((state, { seat, other }) => {
            setJourneyman(state, seat, 'merchant', other)
            setBarn(state, { iron: 1 })
        })
        await openFunction(turn.session, 'merchant', 'pull')
        await pressAll(turn.session, [good('iron')])
        const { result, primary, count } = benchOf(turn.session)
        expect(result?.line).toBe('0 vp · no writ')
        expect(primary).toEqual({ label: 'Move 1 good', enabled: true })
        expect(count).toBeUndefined()
        await turn.session.sendTurnCard()
        await settled(turn.session)
        expect(sentBy(turn)).toHaveLength(1)
    })
})

describe('S43 R-4.6.5, R-4.6.6 an Alchemist push', () => {
    it('R-4.6.6 the first barrel’s price; its ghost fills every Knight row', async () => {
        const turn = await table((state, { seat }) => {
            setMaster(state, seat, 'alchemist')
            setCarts(state, AllCarts)
        })
        const { session } = turn
        await openFunction(session, 'alchemist', 'push')
        const alone = itemOf(session, 'invention:krud-barrel').note?.label
        await pressItem(session, 'invention:ship')
        expect(itemOf(session, 'invention:krud-barrel').note?.label).toBe(alone)
        await pressItem(session, 'invention:krud-barrel')
        const { ghosts, primary } = benchOf(session)
        const rows = knightRows(session.gameState)
        expect(
            ghosts.filter(({ item }) => item === 'invention:krud-barrel').map(({ at }) => at)
        ).toEqual(rows.map(({ rowId }) => `knight-row:${rowId}`))
        expect(ghosts.filter(({ item }) => item === 'invention:ship')).toHaveLength(1)
        expect(primary.label).toMatch(/^Invent 2/)
        expect(itemOf(session, 'invention:krud-barrel').note?.label).not.toBe(alone)
    })
})

describe('S44 R-4.6.3, R-4.2.4 a Knight trade that tames', () => {
    let deploy: readonly SpaceId[] = []

    async function row4() {
        const turn = await table((state, { seat }) => {
            const markers = [0, 0, 0, 0]
            markers[seatRowIndex(state, seat)] = 4
            setRowMarkers(state, markers)
            setShillings(state, seat, 9)
            setMarket(state, { iron: 4 })
            deploy = [ruleTown(state, seat), ruleTown(state, seat)]
        })
        const { session } = turn
        await openFunction(session, 'knight', 'trade')
        return turn
    }

    it('R-4.6.3 the row’s price and markers; the press asks; a tame collapses to the map', async () => {
        const { session } = await row4()
        const bench = benchOf(session)
        expect(session.guild.entry('guild')?.source).toBe('manual')
        expect(bench.items.map(({ label }) => label)).toEqual(['3s: take 4 markers'])
        await pressItem(session, 'row:seat')
        expect(benchOf(session).popup?.choices.at(-1)?.label).toBe('No')
        await pressChoice(session, popupRow(session, /behemoth/))

        const tamed = benchOf(session)
        expect(tamed.collapsed).toBe('Pick a space.')
        expect(tamed.items).toEqual([])
        expect(session.guildPanel?.line).toBe('Pick a space.')
        const lit = (session.guild.pick?.targets ?? []).map(({ target }) => target)
        expect(lit).toEqual(expect.arrayContaining(deploy.map(spaceTarget)))
    })

    it('R-4.2.4 a space’s press sends the tame', async () => {
        const turn = await row4()
        const { session } = turn
        await pressItem(session, 'row:seat')
        await pressChoice(session, popupRow(session, /behemoth/))
        const [spaceId] = deploy
        assertExists(spaceId, 'A space is ruled')
        await pressTarget(session, spaceTarget(spaceId))
        expect(sentBy(turn)[0]).toMatchObject({
            guildId: 'knight',
            fn: 'trade',
            params: { monster: 'behemoth', deploySpaceId: spaceId }
        })
    })

    it('S62 Undo reopens the bench with its popup, then takes the row back', async () => {
        const { session } = await row4()
        await pressItem(session, 'row:seat')
        await pressChoice(session, popupRow(session, /behemoth/))
        await undo(session)
        expect(benchOf(session).collapsed).toBeUndefined()
        expect(benchOf(session).items).toHaveLength(1)
        expect(session.guildPanel?.popup).toBeDefined()
        await undo(session)
        expect(session.guildPanel?.popup).toBeUndefined()
        expect(session.guild.value('take')).toBeUndefined()
    })

    it('R-4.6.3 "No" takes the row and tames nothing', async () => {
        const turn = await row4()
        await pressItem(turn.session, 'row:seat')
        await pressChoice(turn.session, popupRow(turn.session, /^No$/))
        const [sent] = sentBy(turn)
        expect(sent).toMatchObject({ guildId: 'knight', fn: 'trade', params: {} })
        expect(sent).not.toHaveProperty('params.monster')
    })
})

describe('S44 R-4.6.3 a Farmer trade goes to the map', () => {
    it('R-4.6.3 the bench collapses to the farms; a farm’s popup splits; Undo reopens it', async () => {
        const turn = await table((state, { seat }) => {
            ruleFarm(state, seat, { food: 4 })
            ruleFarm(state, seat, { wood: 4 })
        })
        const { session } = turn
        await openFunction(session, 'farmer', 'trade')
        expect(benchOf(session).collapsed).toBe('Pick a farm.')
        const target = benchOf(session).map?.at(0)?.target
        assertExists(target, 'A farm is lit')
        await pressTarget(session, target)
        expect(session.guildPanel?.popup?.anchor).toBe(target)
        await undo(session)
        expect(session.guildPanel?.popup).toBeUndefined()
        expect(benchOf(session).collapsed).toBe('Pick a farm.')
    })
})

describe('S45 R-4.6.5 a Knight push', () => {
    async function pushed() {
        const turn = await table((state, { seat }) => {
            setMaster(state, seat, 'knight')
            setRowMarkers(state, [1, 1, 1])
            setScrolls(state, [R1C3])
        })
        await openFunction(turn.session, 'knight', 'push')
        return turn
    }

    it('R-4.6.5 a used row stays picked, with no line, and its press does nothing; a scroll waits for a row', async () => {
        const { session } = await pushed()
        expect(benchOf(session).items.some(({ id }) => id === `scroll:${R1C1}`)).toBe(false)
        await pressItem(session, 'row:knight-row-1')
        expect(itemOf(session, `scroll:${R1C1}`).role).toBe('lit')
        const used = itemOf(session, 'row:knight-row-1')
        expect(used.role).toBe('picked')
        expect(used.refusal).toBeUndefined()
        expect(used.press).toBeUndefined()
        await pressChoice(session, used)
        expect(session.guild.value('picks')).toEqual([{ kind: 'row', row: 'knight-row-1' }])
    })

    it('R-5-H1 a scroll with a seal on it isn’t offered; the panel names no seal', async () => {
        const { session } = await pushed()
        const bench = benchOf(session)
        expect(bench.items.some(({ id }) => id === `scroll:${R1C3}`)).toBe(false)
        const said = JSON.stringify([bench.items, bench.ghosts, bench.result])
        expect(Seals.some(({ id }) => said.includes(`"${id}"`))).toBe(false)
    })

    it('R-4.6.5 fewer than stated: the primary enabled from a whole pair, named for the count', async () => {
        const { session } = await pushed()
        await pressItem(session, 'row:knight-row-1')
        expect(benchOf(session).primary.enabled).toBe(false)
        await pressItem(session, `scroll:${R1C1}`)
        expect(benchOf(session).line).toBe('Move up to 3')
        expect(benchOf(session).primary.enabled).toBe(true)
        expect(benchOf(session).primary.label).toMatch(/^Move 1 marker/)
    })
})

describe('S46 R-4.6.3, R-4.6-H2 a draw of two beads', () => {
    it('R-X.2 both candidates lit, a warning on the primary, and no send until it is pressed', async () => {
        const turn = await table((state, { seat }) => {
            setBeads(state, { rosary: [5, 2], chickens: [] })
            setShillings(state, seat, 9)
        })
        const { session } = turn
        await openFunction(session, 'monk', 'trade')
        const bench = benchOf(session)
        expect(bench.items.map(({ label, role }) => [label, role])).toEqual([
            ['Bead 5', 'lit'],
            ['Bead 2', 'lit']
        ])
        expect(bench.primary).toEqual({ label: "Draw a bead · can't be undone", enabled: true })
        expect(sentBy(turn)).toEqual([])
        await session.sendTurnCard()
        await settled(session)
        expect(sentBy(turn)[0]).toMatchObject({ guildId: 'monk', fn: 'trade' })
    })
})

describe('S47 R-3.16.3 a Feast', () => {
    async function feast() {
        const turn = await table((state, { seat, other, third }) => {
            setPawns(state, seat, ['knight', 'knight'])
            state.supply.haversack.sulfur -= 1
            state.getPlayerState(seat).barrel = 1
            setMaster(state, other, 'merchant')
            setMaster(state, third, 'noble')
            setMarket(state, { wood: 2 })
            const [, second] = state.getPlayerState(seat).pawns
            const [, otherSecond] = state.getPlayerState(other).pawns
            assertExists(second, 'The seat has a second pawn')
            assertExists(otherSecond, 'The opponent has a second pawn')
            second.spaceId = SecondSpace
            otherSecond.spaceId = SecondSpace
        })
        pickCard(turn.session)
        const row = turn.session.turnPanel?.modes.find(({ label }) => label.startsWith('Feast'))
        assertExists(row, 'The card offers a Feast')
        await pressChoice(turn.session, row)
        return turn
    }

    it('R-3.16.3 spaces lit, at the barrel’s cost', async () => {
        const { session } = await feast()
        expect(session.guildPanel?.stage).toBe('feast-space')
        const target = session.guild.pick?.targets.find(
            ({ target: at }) => at === spaceTarget(StandingSpace)
        )
        expect(target?.notes).toEqual([{ kind: 'cost', label: 'feast · 1 barrel sulfur' }])
        expect(session.guild.pick?.targets.map(({ target: at }) => at)).toContain(
            spaceTarget(SecondSpace)
        )
    })

    it('R-3.16.3 lists each opponent’s own function there; one where nothing could move is not drawn', async () => {
        const turn = await feast()
        const { session, other, third } = turn
        await pressTarget(session, spaceTarget(StandingSpace))
        const name = (id: string) => session.getPlayerName(id)
        const live = popupRow(session, new RegExp(`^${name(other)} · Merchant push$`))
        expect(live.press).toBeDefined()
        expect(live.note).toEqual({ kind: 'gain', label: 'up to 3 vp' })
        expect(
            session.guildPanel?.popup?.choices.some(({ label }) =>
                label.startsWith(`${name(third)} · Noble push`)
            )
        ).toBe(false)
    })

    it('R-3.16.3, R-3.16-H2 the result names the feast’s points, no reeve; it sends a Feast', async () => {
        const turn = await feast()
        const { session, other } = turn
        await pressTarget(session, spaceTarget(StandingSpace))
        await pressChoice(session, popupRow(session, /Merchant push/))
        await pressAll(session, [good('wood'), good('wood')])
        const { result } = benchOf(session)
        expect(result?.line).toContain('+3 vp feast')
        expect(result?.reeve).toBeUndefined()
        await session.sendTurnCard()
        await settled(session)
        expect(sentBy(turn)[0]).toMatchObject({
            type: ActionType.Feast,
            spaceId: StandingSpace,
            opponentId: other,
            guildId: 'merchant',
            params: { goods: ['wood', 'wood'] }
        })
    })

    async function benchFeast() {
        const turn = await feast()
        const { session } = turn
        await pressTarget(session, spaceTarget(StandingSpace))
        await pressChoice(session, popupRow(session, /Merchant push/))
        await pressAll(session, [good('wood')])
        expect(session.guild.value('picks')).toHaveLength(1)
        return turn
    }

    it('1 R-3.16.3 setting the space clears the opponent and the picks', async () => {
        const { session } = await benchFeast()
        session.guild.set('feastSpace', StandingSpace)
        flushSync()
        expect(session.guild.value('feastOf')).toBeUndefined()
        expect(session.guild.value('picks')).toBeUndefined()
        expect(session.guildPanel?.stage).toBe('opponent')
    })

    it('2 R-3.16.3 Undo pops the highest manual stage, and undoes no Action', async () => {
        const turn = await benchFeast()
        const { session } = turn
        await undo(session)
        expect(session.guild.value('picks') ?? []).toEqual([])
        expect(session.guild.value('feastOf')).toBeDefined()
        await undo(session)
        expect(session.guild.value('feastOf')).toBeUndefined()
        expect(session.guild.value('feastSpace')).toBe(StandingSpace)
        expect(sentBy(turn)).toEqual([])
    })

    it('3 R-3.16.3 Undo with only an auto space goes on to the card’s mode', async () => {
        const turn = await feast()
        const { session } = turn
        session.guild.set('feastSpace', StandingSpace, 'auto')
        flushSync()
        expect(session.guild.hasManual).toBe(false)
        expect(session.guild.localSelection.undo()).toBe(false)
        await undo(session)
        expect(session.turn.mode).toBeUndefined()
        expect(session.guildPanel).toBeUndefined()
        expect(sentBy(turn)).toEqual([])
    })

    it('4 R-3.16.3 a stage the order lacks throws', () => {
        const lacking = new StagedDraft<GuildDraftValues>(
            GuildStageOrder.filter((stage) => stage !== 'feastOf')
        )
        expect(() => {
            lacking.set('feastOf', { opponentId: 'a', guildId: 'merchant' })
        }).toThrow(/does not exist in stage order/)
    })

    it('5 R-3.16.3 the card pressed again ends the draft', async () => {
        const turn = await benchFeast()
        const { session } = turn
        pickCard(session)
        expect(session.guild.selection).toEqual({})
        expect(session.guildPanel).toBeUndefined()
        expect(sentBy(turn)).toEqual([])
    })

    it('a lone space reads through as auto, and its popup still asks', async () => {
        const turn = await table((state, { seat, other }) => {
            setPawns(state, seat, ['knight'])
            state.supply.haversack.sulfur -= 1
            state.getPlayerState(seat).barrel = 1
            setMaster(state, other, 'merchant')
            setMarket(state, { wood: 2 })
        })
        const { session } = turn
        pickCard(session)
        const row = session.turnPanel?.modes.find(({ label }) => label.startsWith('Feast'))
        assertExists(row, 'The card offers a Feast')
        await pressChoice(session, row)
        expect(session.guild.entry('feastSpace')).toEqual({ value: StandingSpace, source: 'auto' })
        expect(session.guildPanel?.stage).toBe('opponent')
    })
})

describe('S48 R-4.6.2, R-4.3-H3 a price short of what a tile can bring', () => {
    it('R-4.6.2 a function short of shillings is not drawn: a tile brings no shilling', async () => {
        const turn = await table((state, { seat, other }) => {
            setJourneyman(state, seat, 'merchant', other)
            setBarn(state, { iron: 1 })
            setMarket(state, { iron: 3 })
            setShillings(state, seat, 0)
            giveTile(state, seat)
        })
        const { session, seat } = turn
        expect(session.gameState.getPlayerState(seat).regionTiles).toHaveLength(1)
        pickCard(session)
        await pressTarget(session, guildTarget('merchant'))
        expect(
            session.guildPanel?.popup?.choices.some(({ label }) => label.startsWith('Trade'))
        ).toBe(false)
        expect(session.guildPanel?.popup?.choices.some(({ label }) => /cover/i.test(label))).toBe(
            false
        )
    })

    it('R-4.3-H3 a Feast short of barrel sulfur, with a tile, is not drawn', async () => {
        const turn = await table((state, { seat, other }) => {
            setPawns(state, seat, ['knight'])
            setMaster(state, other, 'merchant')
            setMarket(state, { wood: 2 })
            state.getPlayerState(seat).barrel = 0
            giveTile(state, seat)
        })
        const { session } = turn
        pickCard(session)
        expect(session.turnPanel?.modes.some(({ label }) => label.startsWith('Feast'))).toBe(false)
    })

    it('R-3.4 a Feast short of barrel sulfur, with no tile, doesn’t show', async () => {
        const turn = await table((state, { seat, other }) => {
            setPawns(state, seat, ['knight'])
            setMaster(state, other, 'merchant')
            state.getPlayerState(seat).barrel = 0
        })
        pickCard(turn.session)
        expect(turn.session.turnPanel?.modes.some(({ label }) => label.startsWith('Feast'))).toBe(
            false
        )
    })
})

describe('R-3.16 pick conventions: a lone choice and its send', () => {
    const lone = Families.find(({ guildId, fn }) => guildId === 'alchemist' && fn === 'trade')

    it('a lone guild is auto, so a finishing press stages for the primary', async () => {
        assertExists(lone, 'The table holds an Alchemist trade')
        const turn = await table((state, seats) => {
            lone.arrange(state, seats)
            setBeads(state, { rosary: [], chickens: [] })
            setRowMarkers(state, [])
        })
        const { session } = turn
        pickCard(session)
        expect(session.guild.entry('guild')).toEqual({ value: 'alchemist', source: 'auto' })
        await pressChoice(session, popupRow(session, /^Trade/))
        await pressItem(session, 'vessel:ship')
        expect(sentBy(turn)).toEqual([])
        expect(session.guildPanel?.primary).toEqual({ label: 'Buy a vessel', enabled: true })
        await session.sendTurnCard()
        await settled(session)
        expect(sentBy(turn)).toHaveLength(1)
    })

    it('several guilds lit: the finishing press sends', async () => {
        assertExists(lone, 'The table holds an Alchemist trade')
        const turn = await table((state, seats) => {
            lone.arrange(state, seats)
            setMarket(state, { iron: 4 })
        })
        await openFunction(turn.session, 'alchemist', 'trade')
        await pressItem(turn.session, 'vessel:ship')
        expect(sentBy(turn)[0]).toMatchObject({ params: { vesselType: 'ship' } })
    })

    it('a press on a picked vessel takes it back', async () => {
        assertExists(lone, 'The table holds an Alchemist trade')
        const turn = await table((state, seats) => {
            lone.arrange(state, seats)
            setBeads(state, { rosary: [], chickens: [] })
            setRowMarkers(state, [])
        })
        const { session } = turn
        pickCard(session)
        await pressChoice(session, popupRow(session, /^Trade/))
        await pressItem(session, 'vessel:ship')
        await pressItem(session, 'vessel:ship')
        expect(session.guild.value('picks')).toEqual([])
        expect(session.guildPanel?.primary).toBeUndefined()
    })
})

describe('R-X.1 who has it (contract: Coexistence and precedence)', () => {
    const merchant = Families.find(({ guildId, fn }) => guildId === 'merchant' && fn === 'pull')

    async function staged() {
        assertExists(merchant, 'The table holds a Merchant pull')
        const turn = await atBench(merchant)
        await pressAll(turn.session, merchant.presses.slice(0, 1))
        return turn
    }

    it('another seat has no panel and no pick', async () => {
        const turn = await staged()
        const watching = await turn.host.openSeat(turn.other)
        expect(watching.guildPanel).toBeUndefined()
        expect(watching.guild.pick).toBeUndefined()
        await watching.pressTurnTarget(guildTarget('merchant'))
        expect(watching.guild.selection).toEqual({})
    })

    it('History View offers no bench, a press does nothing, and the picks do not come back', async () => {
        const turn = await staged()
        const { session } = turn
        await session.history.goToPreviousAction()
        await settled(session)
        expect(session.isViewingHistory).toBe(true)
        expect(session.guildPanel).toBeUndefined()
        expect(session.guild.selection).toEqual({})
        await session.pressTurnTarget(guildTarget('merchant'))
        await session.sendTurnCard()
        expect(sentBy(turn)).toEqual([])
        session.history.goToEnd()
        await settled(session)
        expect(session.guild.value('picks') ?? []).toEqual([])
    })

    it('the board asks through the card’s own pick', async () => {
        const turn = await table((state, { seat, other }) => {
            setJourneyman(state, seat, 'merchant', other)
            setBarn(state, { iron: 1 })
            setVesselsForSale(state, ['ship'])
            setShillings(state, seat, 9)
        })
        pickCard(turn.session)
        expect(turn.session.boardOffer.targets.has(guildTarget('merchant'))).toBe(true)
        expect(turn.session.boardOffer.dimsRest).toBe(true)
    })
})
