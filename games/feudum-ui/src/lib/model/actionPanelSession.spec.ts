import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { flushSync } from 'svelte'
import { ActionSource, assertExists, type GameAction } from '@tabletop/common'
import {
    ActionType,
    chooseFavoursOffer,
    FarmerBarn,
    handSelectionGroup,
    HydratedFeudumGameState,
    MachineState,
    placeMarker,
    playMandateOffers,
    StartingSpaceIds,
    writDeckCount,
    type ActionCardKind,
    type SpaceId
} from '@tabletop/feudum'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ActionBlock } from './actionPanel.js'
import {
    blockOf,
    cardRows,
    linesOf,
    pressCard,
    pressRow,
    primaryLabels,
    primaryNamed,
    rowLabels,
    rowNamed,
    rowsOf
} from '$lib/testing/actionPanelView.js'
import {
    atDisc,
    holdFood,
    holdWrit,
    seatedAtCards,
    threePawns,
    type SeatTable
} from '$lib/testing/followUpTable.js'
import {
    guildTable,
    ruleFarm,
    setBarn,
    setBeads,
    setJourneyman,
    setMarket,
    setMaster,
    setPawns,
    setScrolls,
    setShillings,
    StandingSpace,
    type GuildArrange,
    type GuildTable
} from '$lib/testing/guildTable.js'
import { FeudumHost, settled } from '$lib/testing/sessionHarness.js'
import {
    addPawn,
    atPlayingCards,
    buildFeudum,
    emptySpace,
    giveBead,
    giveGood,
    giveSeal,
    giveTile,
    returnGoods,
    ruleOutpost,
    ruleTown,
    type TurnTable
} from '$lib/testing/turnTable.js'
import { CantBeUndone } from './confirmingSend.js'
import { handDraftKey } from './handDraft.svelte.js'
import {
    guildTarget,
    markerTarget,
    pawnTarget,
    spaceTarget,
    type BoardTarget
} from './boardOffer.js'
import type { FeudumGameSession } from './session.svelte.js'

let host: FeudumHost | undefined

beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined)
})

afterEach(() => {
    host?.close()
    host = undefined
    vi.restoreAllMocks()
})

const Inland: SpaceId = 'space.desert.3'
const RoadEnd: SpaceId = 'space.desert.1'
const FourCards: readonly ActionCardKind[] = ['move', 'tax', 'guild', 'explore']

function openHost(numPlayers = 3): FeudumHost {
    host = new FeudumHost(numPlayers)
    return host
}

async function atHands(numPlayers = 3): Promise<FeudumHost> {
    const table = openHost(numPlayers)
    await table.playStartingGoods()
    await table.playStartingPawns()
    expect(table.state.machineState).toBe(MachineState.SelectingHands)
    return table
}

async function atCards(
    cards: readonly ActionCardKind[],
    arrange?: (state: HydratedFeudumGameState, turn: TurnTable) => void,
    options: Parameters<typeof atPlayingCards>[1] = {}
): Promise<TurnTable & { session: FeudumGameSession }> {
    const turn = await atPlayingCards(cards, options)
    host = turn.host
    turn.host.edit((state) => {
        arrange?.(state, turn)
        state.recomputeRanks()
    })
    return { ...turn, session: await turn.host.openSeat(turn.seat) }
}

async function atGuild(arrange: GuildArrange): Promise<GuildTable> {
    const turn = await guildTable(arrange)
    host = turn.host
    flushSync()
    return turn
}

function hold<T extends SeatTable>(table: T): T {
    host = table.host
    return table
}

/** The seat's press; what the machine plays after it doesn't count. */
function lastByUser(table: { readonly host: FeudumHost }): GameAction | undefined {
    return table.host.actions.findLast(({ source }) => source === ActionSource.User)
}

async function pressTarget(session: FeudumGameSession, target: BoardTarget) {
    await session.pressTurnTarget(target)
    flushSync()
}

async function pressPopup(session: FeudumGameSession, label: string | RegExp) {
    const choice = session.boardPopup?.choices.find((row) =>
        typeof label === 'string' ? row.label === label : label.test(row.label)
    )
    assertExists(choice, `The popup has ${label}`)
    await session.pressPopupChoice(choice)
    flushSync()
}

/** Press the primary this label names; it must really reveal, and the table goes on. */
async function sendNamed(session: FeudumGameSession, label: string | RegExp) {
    await primaryNamed(session.actionPanel, label).send()
    await settled(session)
}

describe('Setup', () => {
    it('S1 R-1.4.8 five goods with the count; the sulfur’s own line under them; the primary names all three; Undo; the send', async () => {
        const table = openHost()
        const seat = table.setupSeat
        const session = await table.openSeat(seat)
        const counts = session.gameState.supply.haversack
        const goodsRow = [
            `Saltpeter ${counts.saltpeter}`,
            `Sulfur ${counts.sulfur}`,
            `Iron ${counts.iron}`,
            `Wood ${counts.wood}`,
            `Food ${counts.food}`
        ]
        expect(rowLabels(session.actionPanel, 'goods')).toEqual(goodsRow)
        expect(rowsOf(session.actionPanel, 'goods').map(({ art }) => art)).toEqual(
            ['saltpeter', 'sulfur', 'iron', 'wood', 'food'].map((good) => ({ kind: 'good', good }))
        )
        // Beside each piece its count alone; the name is the row's accessible name.
        expect(rowsOf(session.actionPanel, 'goods').map(({ choice }) => choice.shown)).toEqual(
            goodsRow.map((label) => label.split(' ')[1])
        )
        expect(primaryLabels(session.actionPanel)).toEqual([])
        expect(rowsOf(session.actionPanel, 'sulfur')).toEqual([])

        await pressRow(rowNamed(session.actionPanel, /^Saltpeter/))
        await pressRow(rowNamed(session.actionPanel, /^Sulfur/))
        const blockNames = () =>
            session.actionPanel.blocks.flatMap((block) =>
                block.kind === 'rows' ? [block.name] : []
            )
        expect(blockNames()).toEqual(['goods', 'sulfur'])
        expect(rowLabels(session.actionPanel, 'goods')).toEqual(goodsRow)
        const line = session.actionPanel.blocks.find(
            (block) => block.kind === 'rows' && block.name === 'sulfur'
        )
        expect(line?.kind === 'rows' && line.heading).toBe('Sulfur:')
        const sulfurLine = () =>
            rowsOf(session.actionPanel, 'sulfur').map(({ choice }) => [
                choice.label,
                choice.shown,
                choice.picked
            ])
        expect(sulfurLine()).toEqual([
            ['Keep the sulfur', 'Keep it', true],
            ['Put the sulfur into the barrel', 'Into the barrel', false]
        ])

        await pressRow(rowNamed(session.actionPanel, 'Put the sulfur into the barrel'))
        await pressRow(rowNamed(session.actionPanel, /^Food/))
        expect(blockNames()).toEqual(['goods', 'sulfur'])
        // Three picked: the two others stand in place, spent (dimmed, with no line).
        expect(rowLabels(session.actionPanel, 'goods')).toEqual(goodsRow)
        expect(
            rowsOf(session.actionPanel, 'goods').map(({ choice }) => [
                choice.spent === true,
                choice.refusal
            ])
        ).toEqual([
            [false, undefined],
            [false, undefined],
            [true, undefined],
            [true, undefined],
            [false, undefined]
        ])
        expect(sulfurLine()).toEqual([
            ['Keep the sulfur', 'Keep it', false],
            ['Put the sulfur into the barrel', 'Into the barrel', true]
        ])
        const primary = primaryNamed(session.actionPanel, /^Take/)
        expect(primary.label).toBe('Take saltpeter, sulfur (barrel), food')

        await session.undo()
        flushSync()
        expect(rowNamed(session.actionPanel, /^Food/).choice.picked).toBe(false)
        expect(rowNamed(session.actionPanel, 'Put the sulfur into the barrel').choice.picked).toBe(
            true
        )
        await session.undo()
        flushSync()
        expect(rowNamed(session.actionPanel, 'Keep the sulfur').choice.picked).toBe(true)
        await session.undo()
        flushSync()
        expect(rowNamed(session.actionPanel, /^Sulfur/).choice.picked).toBe(false)
        expect(rowsOf(session.actionPanel, 'sulfur')).toEqual([])

        await pressRow(rowNamed(session.actionPanel, /^Sulfur/))
        await pressRow(rowNamed(session.actionPanel, /^Food/))
        await pressRow(rowNamed(session.actionPanel, 'Put the sulfur into the barrel'))
        await sendNamed(session, 'Take saltpeter, sulfur (barrel), food')
        expect(table.sent.get(seat)?.[0]).toMatchObject({
            type: ActionType.ChooseStartingGoods,
            sulfurToBarrel: true
        })
        expect(session.gameState.getPlayerState(seat).barrel).toBe(1)
    })

    it('S1 R-1.4.8 others read who chooses, and the haversack counts', async () => {
        const table = openHost()
        const waiting = table.order.find((id) => id !== table.setupSeat) ?? ''
        const session = await table.openSeat(waiting)
        const name = session.getPlayerName(table.setupSeat)
        expect(linesOf(session.actionPanel, 'waiting')).toEqual([`Waiting on ${name}.`])
        expect(blockOf(session.actionPanel, 'goods-counts')?.counts).toEqual(
            ['saltpeter', 'sulfur', 'iron', 'wood', 'food'].map((good) => ({
                good,
                count: session.gameState.supply.haversack[good as 'iron']
            }))
        )
        expect(rowsOf(session.actionPanel)).toEqual([])
    })

    it('S2 R-1.4.9 six characters as guild dice, each with its rank; a press and the hover both light the six spaces; a lit space sends', async () => {
        const table = openHost()
        await table.playStartingGoods()
        const seat = table.setupSeat
        const session = await table.openSeat(seat)
        const rows = rowsOf(session.actionPanel, 'characters')
        expect(rows.map(({ art }) => art?.kind === 'die' && art.guild).sort()).toEqual([
            'alchemist',
            'farmer',
            'knight',
            'merchant',
            'monk',
            'noble'
        ])
        const knight = rowNamed(session.actionPanel, 'Knight, master')
        expect(knight.art).toEqual({ kind: 'die', guild: 'knight', rank: 'master' })
        expect(knight.choice.note).toBeUndefined()
        expect(knight.choice.lights?.()).toEqual(StartingSpaceIds.map(spaceTarget))

        await pressRow(knight)
        expect(rowNamed(session.actionPanel, 'Knight, master').choice.picked).toBe(true)
        await session.pressStartingSpace(Inland)
        await settled(session)
        expect(table.sent.get(seat)?.[0]).toMatchObject({
            type: ActionType.PlaceStartingPawn,
            character: 'knight',
            spaceId: Inland
        })
    })

    it('S2 R-1.4.9 the space first: the panel steps aside and the popup asks, with the same dice', async () => {
        const table = openHost()
        await table.playStartingGoods()
        const session = await table.openSeat(table.setupSeat)
        await session.pressStartingSpace(Inland)
        flushSync()
        expect(rowsOf(session.actionPanel, 'characters')).toEqual([])
        expect(linesOf(session.actionPanel)).toEqual(['Who stands here?'])
        const knight = session.boardPopup?.choices.find(({ label }) => label === 'Knight, master')
        expect(knight?.art).toEqual({ kind: 'die', guild: 'knight', rank: 'master' })
        expect(knight?.note).toBeUndefined()
    })

    it('S2 R-1.4.9 another seat reads who places', async () => {
        const table = openHost()
        await table.playStartingGoods()
        const waiting = table.order.find((id) => id !== table.setupSeat) ?? ''
        const session = await table.openSeat(waiting)
        expect(linesOf(session.actionPanel, 'waiting')).toEqual([
            `Waiting on ${session.getPlayerName(table.setupSeat)}.`
        ])
    })

    it('S3 R-4.5 the rank badge follows the tracks, down to none', async () => {
        const table = openHost(5)
        await table.playStartingGoods()
        for (const rank of ['master', 'journeyman', 'apprentice', 'none'] as const) {
            const seat = table.setupSeat
            const session = await table.openSeat(seat)
            const knight = rowsOf(session.actionPanel, 'characters').find(
                ({ art }) => art?.kind === 'die' && art.guild === 'knight'
            )
            expect(knight?.art).toEqual({ kind: 'die', guild: 'knight', rank })
            expect(knight?.choice.label).toBe(`Knight, ${rank === 'none' ? 'no rank' : rank}`)
            await table.send(seat, {
                type: ActionType.PlaceStartingPawn,
                character: 'knight',
                spaceId: Inland
            })
        }
    })
})

describe('Hand selection', () => {
    it('S4 R-3.1-H1 the finalise row, in turn order; a later seat may send first; its pouch good is its own until the reveal', async () => {
        const table = await atHands(2)
        const [first, second] = table.order
        table.edit((state) => {
            giveGood(state, first, 'saltpeter')
            giveGood(state, second, 'sulfur')
        })
        const session = await table.openSeat(second)
        const row = () => blockOf(session.actionPanel, 'finalise')?.entries
        expect(row()?.map(({ name }) => name)).toEqual(
            table.order.map((id) => session.getPlayerName(id))
        )
        expect(row()?.every(({ finalised }) => !finalised)).toBe(true)
        expect(cardRows(session.actionPanel)).toHaveLength(11)
        expect(blockOf(session.actionPanel, 'cards')?.tone).toBe('draft')

        for (const kind of FourCards) {
            await pressCard(session.actionPanel, kind)
        }
        await pressRow(rowNamed(session.actionPanel, /^Sulfur/))
        expect(primaryLabels(session.actionPanel)).toEqual(['Long live the king'])
        await sendNamed(session, 'Long live the king')

        // R-3.1-H1 Its own good stands sealed in its tray, not on its chip.
        expect(row()?.[1]).toMatchObject({ finalised: true })
        expect(row()?.[1]).not.toHaveProperty('pouchGood')
        expect(blockOf(session.actionPanel, 'hand-set')).toMatchObject({
            cards: FourCards.map((kind) => ({ kind })),
            pouch: { good: 'sulfur', title: '2 in a row' }
        })
        expect(linesOf(session.actionPanel, 'waiting')).toEqual([
            `Waiting on ${session.getPlayerName(first)}.`
        ])
        const fresh = await table.openSeat(first)
        const freshRow = () => blockOf(fresh.actionPanel, 'finalise')?.entries
        expect(freshRow()?.[1].finalised).toBe(true)
        expect(freshRow()?.[1]).not.toHaveProperty('pouchGood')
        expect(blockOf(fresh.actionPanel, 'hand-set')).toBeUndefined()
        // R-X.2 No send until its hand is picked.
        expect(primaryLabels(fresh.actionPanel)).toEqual([])

        for (const kind of [...FourCards, 'harvest'] as const) {
            await pressCard(fresh.actionPanel, kind)
        }
        await pressRow(rowNamed(fresh.actionPanel, /^Saltpeter/))
        await sendNamed(fresh, 'Long live the king')
        await settled(session)
        expect(session.gameState.machineState).toBe(MachineState.PlayingCards)
        expect(session.gameState.getPlayerState(first).pouch).toBe('saltpeter')
        expect(session.gameState.getPlayerState(second).pouch).toBe('sulfur')
    })

    it('R-3.1-H1 the waiting line names every seat yet to finalise', async () => {
        const table = await atHands(3)
        const [first, second, third] = table.order
        const session = await table.openSeat(second)
        for (const kind of FourCards) {
            await pressCard(session.actionPanel, kind)
        }
        await sendNamed(session, 'Long live the king')
        const name = (id: string) => session.getPlayerName(id)
        expect(linesOf(session.actionPanel, 'waiting')).toEqual([
            `Waiting on ${name(first)} and ${name(third)}.`
        ])
        const watching = await table.openSpectator()
        expect(linesOf(watching.actionPanel, 'waiting')).toEqual([
            `Waiting on ${name(first)} and ${name(third)}.`
        ])
    })

    it('S5 R-3.3 the count and the primary follow saltpeter; Undo removes the last press', async () => {
        const table = await atHands()
        const [first] = table.order
        table.edit((state) => {
            giveGood(state, first, 'saltpeter')
        })
        const session = await table.openSeat(first)
        for (const kind of FourCards) {
            await pressCard(session.actionPanel, kind)
        }
        const count = () => linesOf(session.actionPanel, 'count')
        expect(count()).toEqual(['4 of 4'])
        expect(blockOf(session.actionPanel, 'line')?.lead).toBe('Hand')
        expect(blockOf(session.actionPanel, 'finalise')?.lead).toMatch(
            /^Round \d+ · choose your hand$/
        )
        const sends = () => primaryLabels(session.actionPanel)
        expect(sends()).toEqual(['Long live the king'])
        await pressRow(rowNamed(session.actionPanel, /^Saltpeter/))
        expect(count()).toEqual(['4 of 5'])
        // R-X.2 The send is not drawn until the hand is complete.
        expect(sends()).toEqual([])
        await pressCard(session.actionPanel, 'harvest')
        expect(count()).toEqual(['5 of 5'])
        expect(sends()).toEqual(['Long live the king'])
        await pressRow(rowNamed(session.actionPanel, /^Saltpeter/))
        expect(count()).toEqual(['5 of 4'])
        expect(sends()).toEqual([])
        await session.undo()
        flushSync()
        expect(count()).toEqual(['5 of 5'])
        expect(sends()).toEqual(['Long live the king'])
    })

    it('R-3.1, R-3.1-H1 the finalise row: everyone at once, and the pouch goods shown when all have finalised', async () => {
        const table = await atHands()
        const drafting = await table.openSeat(table.order[1])
        const watching = await table.openSpectator()
        for (const session of [drafting, watching]) {
            expect(blockOf(session.actionPanel, 'finalise')?.caption).toBe(
                'everyone at once · pouch goods shown when all have finalised'
            )
        }
        expect(
            blockOf(drafting.actionPanel, 'finalise')?.entries.map(({ playerId, you }) => [
                playerId,
                you
            ])
        ).toEqual(table.order.map((playerId) => [playerId, playerId === table.order[1]]))
        expect(blockOf(watching.actionPanel, 'finalise')?.entries.some(({ you }) => you)).toBe(
            false
        )
    })

    it('R-3.1, R-3.3 tray A: the hand counted under its label, the pouch headed "one or none"', async () => {
        const table = await atHands()
        const session = await table.openSeat(table.order[0])
        const count = blockOf(session.actionPanel, 'line')
        expect([count?.role, count?.lead, count?.text]).toEqual(['count', 'Hand', '0 of 4'])
        const pouch = session.actionPanel.blocks.find(
            (block) => block.kind === 'rows' && block.name === 'pouch'
        )
        expect(pouch?.kind === 'rows' && [pouch.heading, pouch.hint]).toEqual([
            'Pouch',
            'one or none'
        ])
    })

    it('R-3.1 the plan: a press fills the next slot and numbers the card; the slot or the card takes it back', async () => {
        const table = await atHands()
        const [first] = table.order
        table.edit((state) => {
            giveGood(state, first, 'saltpeter')
        })
        const session = await table.openSeat(first)
        const slots = () => blockOf(session.actionPanel, 'slots')
        const filled = () => slots()?.slots.map(({ card }) => card?.kind)
        const slotOf = (kind: string) =>
            cardRows(session.actionPanel).find((row) => row.kind === kind)?.slot
        expect(slots()?.slots.map(({ at }) => at)).toEqual([1, 2, 3, 4])
        expect(slots()?.caption).toBe('play in any order')

        await pressCard(session.actionPanel, 'tax')
        await pressCard(session.actionPanel, 'move')
        expect(filled()).toEqual(['tax', 'move', undefined, undefined])
        expect([slotOf('tax'), slotOf('move'), slotOf('guild')]).toEqual([1, 2, undefined])

        await pressRow(rowNamed(session.actionPanel, /^Saltpeter/))
        expect(slots()?.slots.map(({ at }) => at)).toEqual([1, 2, 3, 4, 5])

        await slots()?.slots[0]?.card?.press()
        flushSync()
        expect(filled()).toEqual(['move', undefined, undefined, undefined, undefined])
        expect(slotOf('move')).toBe(1)

        await pressCard(session.actionPanel, 'move')
        expect(filled()?.every((kind) => kind === undefined)).toBe(true)
    })

    it('R-3.3 the pouch is two choices drawn with their goods, each with what it does', async () => {
        const table = await atHands()
        const session = await table.openSeat(table.order[0])
        expect(
            rowsOf(session.actionPanel, 'pouch').map(({ art, choice, caption }) => [
                art?.kind === 'good' ? art.good : art?.kind,
                choice.shown,
                caption
            ])
        ).toEqual([
            ['saltpeter', '+1 card', 'opens a fifth slot'],
            ['sulfur', '2 in a row', 'once this round']
        ])
    })

    it("R-X.2 the send's second line: it finalises and can't be undone", async () => {
        const table = await atHands()
        const session = await table.openSeat(table.order[0])
        for (const kind of FourCards) {
            await pressCard(session.actionPanel, kind)
        }
        expect(primaryNamed(session.actionPanel, 'Long live the king').note).toBe(
            "finalise · can't be undone"
        )
    })

    it('R-3.1 the draft stands as one: the cards, and beside them the hand, the pouch and the send', async () => {
        const table = await atHands()
        const session = await table.openSeat(table.order[0])
        for (const kind of FourCards) {
            await pressCard(session.actionPanel, kind)
        }
        const places = session.actionPanel.blocks.map(({ kind, stands }) => [kind, stands])
        expect(places).toContainEqual(['cards', undefined])
        for (const kind of ['finalise', 'slots', 'rows', 'primary'] as const) {
            expect(places).toContainEqual([kind, 'draft'])
        }
    })

    it('S6 R-3.3 a seat with sulfur only in its barrel: the row is dimmed, with the line, and has no effect', async () => {
        const table = await atHands()
        const [first] = table.order
        table.edit((state) => {
            returnGoods(state, first)
            state.getPlayerState(first).barrel = 1
        })
        const session = await table.openSeat(first)
        expect(rowLabels(session.actionPanel, 'pouch')).toEqual([
            'Saltpeter: 5 cards',
            'Sulfur: two cards back to back'
        ])
        const sulfur = rowNamed(session.actionPanel, /^Sulfur/)
        expect(sulfur.choice.refusal).toBe("Barrel sulfur can't go in the pouch.")
        await pressRow(sulfur)
        expect(rowNamed(session.actionPanel, /^Sulfur/).choice.picked).toBe(false)
    })

    it('S7 R-3.13-H1 the warning line shows and does not disable the send', async () => {
        const table = await atHands()
        const [first] = table.order
        const session = await table.openSeat(first)
        for (const kind of ['conquer', 'move', 'tax', 'guild'] as const) {
            await pressCard(session.actionPanel, kind)
        }
        expect(linesOf(session.actionPanel, 'warning')).toEqual([
            'Conquer may end up your last card; it would be forfeited.'
        ])
        expect(primaryLabels(session.actionPanel)).toEqual(['Long live the king'])
    })

    it("R-3.1 one seat's draft is not the next seat's, at a shared screen", async () => {
        const table = await atHands()
        const [first, second] = table.order
        const { gameState } = await table.openSeat(first)
        expect(handDraftKey(gameState, first)).toBeDefined()
        expect(handDraftKey(gameState, second)).toBeDefined()
        expect(handDraftKey(gameState, first)).not.toBe(handDraftKey(gameState, second))
    })

    it('S8 R-3.1 after the send: no Undo; the cards leave the panel; the row and a waiting line stay', async () => {
        const table = await atHands()
        const [first, second] = table.order
        const session = await table.openSeat(first)
        for (const kind of FourCards) {
            await pressCard(session.actionPanel, kind)
        }
        await sendNamed(session, 'Long live the king')
        expect(lastByUser({ host: table })).toMatchObject({
            type: ActionType.FinaliseHand,
            revealsInfo: true
        })
        expect(session.undoableAction).toBeUndefined()
        expect(cardRows(session.actionPanel)).toEqual([])
        expect(primaryLabels(session.actionPanel)).toEqual([])
        expect(blockOf(session.actionPanel, 'finalise')?.entries[0].finalised).toBe(true)
        const [, , third] = table.order
        expect(linesOf(session.actionPanel, 'waiting')).toEqual([
            `Waiting on ${session.getPlayerName(second)} and ${session.getPlayerName(third)}.`
        ])
    })

    it("S8 R-3.1-H1 the send goes in the round's simultaneous group, so seats pressing together are all taken", async () => {
        const table = await atHands()
        const [first] = table.order
        const session = await table.openSeat(first)
        const group = handSelectionGroup(session.gameState)
        for (const kind of FourCards) {
            await pressCard(session.actionPanel, kind)
        }
        await sendNamed(session, 'Long live the king')
        expect(lastByUser({ host: table })).toMatchObject({
            type: ActionType.FinaliseHand,
            simultaneousGroupId: group
        })
    })

    it('S8 R-3.1-H1 once sent: the hand set, the pouch sealed, and the seats still choosing waited on', async () => {
        const table = await atHands()
        const [first, second, third] = table.order
        const session = await table.openSeat(first)
        for (const kind of FourCards) {
            await pressCard(session.actionPanel, kind)
        }
        await sendNamed(session, 'Long live the king')
        const finalise = blockOf(session.actionPanel, 'finalise')
        expect(finalise?.lead).toMatch(/^Round \d+ · your hand is set$/)
        expect(finalise?.entries.map(({ playerId, awaited }) => [playerId, awaited])).toEqual([
            [first, false],
            [second, true],
            [third, true]
        ])
        const set = blockOf(session.actionPanel, 'hand-set')
        expect(set?.cards.map(({ kind }) => kind)).toEqual(FourCards)
        expect(set?.cards.map(({ label }) => label)).toEqual(['Move', 'Tax', 'Guild', 'Explore'])
        expect(set).not.toHaveProperty('pouch')
        // The line stands right after the tray.
        const kinds = session.actionPanel.blocks.map(({ kind }) => kind)
        expect(kinds.indexOf('line')).toBe(kinds.indexOf('hand-set') + 1)

        // Watching: the row and the line, no tray and no seat waited on.
        const watching = await table.openSpectator()
        expect(blockOf(watching.actionPanel, 'hand-set')).toBeUndefined()
        expect(blockOf(watching.actionPanel, 'finalise')?.lead).toBeUndefined()
        expect(
            blockOf(watching.actionPanel, 'finalise')?.entries.some(({ awaited }) => awaited)
        ).toBe(false)
        // A seat still drafting waits on no one.
        const drafting = await table.openSeat(second)
        expect(
            blockOf(drafting.actionPanel, 'finalise')?.entries.some(({ awaited }) => awaited)
        ).toBe(false)
    })

    it('S9 R-3.1-H1 a reconciliation leaves the panel as drafted', async () => {
        const table = await atHands()
        const [first, second] = table.order
        const session = await table.openSeat(second)
        for (const kind of FourCards) {
            await pressCard(session.actionPanel, kind)
        }
        table.sendUnheard(first, {
            type: ActionType.FinaliseHand,
            revealsInfo: true,
            cards: ['move', 'tax', 'conquer', 'harvest']
        })
        await table.reconcile(second)
        await settled(session)
        expect(
            cardRows(session.actionPanel)
                .filter(({ picked }) => picked)
                .map(({ kind }) => kind)
                .sort()
        ).toEqual([...FourCards].sort())
    })
})

describe('Playing a card', () => {
    it('R-3.3 a card lights on hover what the logic would have it light, unpicked', async () => {
        const { session } = await atCards(['move', 'tax'])
        const row = cardRows(session.actionPanel).find(({ kind }) => kind === 'move')
        expect(row?.lights?.().length).toBeGreaterThan(0)
        expect(row?.picked).toBe(false)
    })

    it('the hand as faces in one row, the line above; a card shows its modes, Forfeit and the toggle', async () => {
        const { session } = await atCards(['tax', 'move', 'guild'], undefined, {
            pouchGood: 'sulfur'
        })
        const view = () => session.actionPanel
        expect(linesOf(view(), 'turn')[0]).toMatch(/^Epoch I · Round \d+ · your 1st card of 3$/)
        expect(blockOf(view(), 'cards')?.tone).toBe('hand')
        expect(cardRows(view()).map(({ kind }) => kind)).toEqual(['tax', 'move', 'guild'])
        expect(cardRows(view()).every(({ picked }) => !picked)).toBe(true)
        expect(rowsOf(view())).toEqual([])
        await pressCard(view(), 'move')
        expect(cardRows(view()).find(({ kind }) => kind === 'move')?.picked).toBe(true)
        expect(rowLabels(view(), 'second')).toEqual(['Play two cards this turn'])
        expect(rowLabels(view(), 'card')).toEqual(['Forfeit'])
        // Move's own lines stand under the hand, and the hand stays.
        expect(linesOf(view(), 'turn')[0]).toMatch(/^Epoch I/)
        expect(linesOf(view(), 'flow')[0]).toMatch(/^Moves left: \d+ of \d+$/)
        expect(cardRows(view())).toHaveLength(3)
    })

    it('R-3.2 a picked card opens its tray: its line, modes, toggle and send, then Forfeit, last and quiet', async () => {
        const { session } = await atCards(['tax', 'move', 'guild'], undefined, {
            pouchGood: 'sulfur'
        })
        const view = () => session.actionPanel
        const standing = () => view().blocks.filter(({ stands }) => stands === 'tray')
        expect(standing()).toEqual([])
        await pressCard(view(), 'move')
        const blocks = view().blocks
        const hand = blocks.findIndex(({ kind }) => kind === 'cards')
        const after = blocks.slice(hand + 1)
        expect(after.length).toBeGreaterThan(0)
        expect(after.every(({ stands }) => stands === 'tray')).toBe(true)
        expect(after[0]).toMatchObject({ kind: 'line', role: 'flow' })
        expect(after.at(-1)).toMatchObject({ kind: 'rows', name: 'card' })
        const [forfeit] = rowsOf(view(), 'card')
        expect(forfeit.choice.label).toBe('Forfeit')
        expect(forfeit.quiet).toBe(true)
        const names = after.map((block) => (block.kind === 'rows' ? block.name : block.kind))
        expect(names.indexOf('second')).toBeLessThan(names.indexOf('card'))
    })

    it('S24 R-3.14.1 a one-press card puts its send in the tray, Forfeit after it', async () => {
        const { session } = await atCards(['defend', 'tax'])
        await pressCard(session.actionPanel, 'defend')
        const tray = session.actionPanel.blocks.filter(({ stands }) => stands === 'tray')
        expect(tray.map(({ kind }) => kind)).toEqual(['primary', 'rows'])
        expect(tray[0]).toMatchObject({ label: 'Play Defend · +1 vp' })
    })

    it('R-3.4 a special shows its printed cost as goods art, its name beside it, and its reason when refused', async () => {
        const { session } = await atCards(['improve', 'tax'], (state, { seat, other }) => {
            placeMarker(state, seat, emptySpace(state, 'town'))
            giveSeal(state, seat)
            const serf = emptySpace(state, 'outpost')
            placeMarker(state, other, serf)
            placeMarker(state, seat, serf)
            giveGood(state, seat, 'wood')
            giveTile(state, seat)
        })
        await pressCard(session.actionPanel, 'improve')
        const modes = rowsOf(session.actionPanel, 'modes')
        expect(modes.map(({ choice }) => choice.label)).toEqual([
            'Improve',
            'Tend Landscape · 1 wood'
        ])
        expect(modes[1].choice).toMatchObject({
            shown: 'Tend Landscape',
            cost: { kind: 'good', good: 'wood', count: 1 }
        })
        expect(modes.every(({ explained }) => explained)).toBe(true)
    })

    it('R-4.3-H3 with no card picked, the at-will chips stand at the end of the hand line', async () => {
        const { session } = await atCards(['improve', 'tax'], (state, { seat }) => {
            giveTile(state, seat)
        })
        const chips = session.actionPanel.blocks.find(
            (block) => block.kind === 'rows' && block.name === 'at-will'
        )
        expect(chips).toMatchObject({ stands: 'hand-end' })
    })

    it('S10 R-3.8.3 the primary reads "Influence", then names the space', async () => {
        let spaceId: SpaceId = RoadEnd
        const { session } = await atCards(['influence', 'tax'], (state, { seat, other }) => {
            spaceId = emptySpace(state, 'outpost')
            addPawn(state, seat, 'merchant', spaceId)
            placeMarker(state, other, spaceId)
        })
        await pressCard(session.actionPanel, 'influence')
        expect(primaryLabels(session.actionPanel)).toEqual(['Influence'])
        await pressTarget(session, spaceTarget(spaceId))
        expect(primaryLabels(session.actionPanel)[0]).toMatch(/^Influence · Money is Influence at /)
        await session.undo()
        flushSync()
        expect(primaryLabels(session.actionPanel)).toEqual(['Influence'])
        await session.undo()
        flushSync()
        expect(primaryLabels(session.actionPanel)).toEqual([])
    })

    it('S11 R-3.13-H1 a last Conquer: only Forfeit, the reason, and its press sends', async () => {
        const turn = await atCards(['conquer'])
        const { session, host: game, seat } = turn
        expect(rowLabels(session.actionPanel)).toEqual(['Forfeit'])
        expect(primaryLabels(session.actionPanel)).toEqual([])
        expect(linesOf(session.actionPanel, 'refusal')).toEqual([
            "Conquer can't be your last card: forfeit it."
        ])
        await pressRow(rowNamed(session.actionPanel, 'Forfeit'))
        await settled(session)
        expect(game.sent.get(seat)?.[0]).toMatchObject({ type: ActionType.ForfeitCard })
    })

    it('S12 R-3.3 the toggle, the send, then "Your second card" and the hand', async () => {
        const { session } = await atCards(
            ['tax', 'guild', 'explore'],
            (state, { seat }) => {
                ruleTown(state, seat)
            },
            { pouchGood: 'sulfur' }
        )
        await pressCard(session.actionPanel, 'tax')
        const toggle = rowNamed(session.actionPanel, 'Play two cards this turn')
        expect(toggle.choice.picked).toBe(false)
        await pressRow(toggle)
        expect(rowNamed(session.actionPanel, 'Play two cards this turn').choice.picked).toBe(true)
        await primaryNamed(session.actionPanel, /^Tax/).send()
        await settled(session)
        expect(linesOf(session.actionPanel, 'turn')).toEqual(['Your second card'])
        expect(cardRows(session.actionPanel).map(({ kind }) => kind)).toEqual(['guild', 'explore'])
    })

    it('S13 R-3.6 the supply pawns as one cube, the spaces, the character popup that sends; Distant Kin', async () => {
        const turn = await atCards(['migrate', 'tax'], (state, { seat }) => {
            giveGood(state, seat, 'food')
            state.getPlayerState(seat).pawns[0].character = 'alchemist'
        })
        const { session } = turn
        await pressCard(session.actionPanel, 'migrate')
        const pawns = rowsOf(session.actionPanel, 'flow')
        // R-1.1 Pawns in supply stand nowhere and have no character: a number would tell them apart
        // by nothing, so they are one cube.
        expect(pawns.map(({ choice }) => choice.label)).toEqual(['Pawn from supply'])
        expect(pawns[0].art).toEqual({ kind: 'pawn', paint: expect.anything() })
        await pressRow(pawns[0])
        expect(rowLabels(session.actionPanel, 'flow')).toContain('Distant Kin')
        await pressRow(rowNamed(session.actionPanel, 'Distant Kin'))
        const [pick] = session.turn.flow?.picks ?? []
        await pressTarget(session, pick.target)
        await pressPopup(session, /^Monk, /)
        await settled(session)
        expect(lastByUser(turn)).toMatchObject({ type: ActionType.Migrate, distantKin: true })
        expect(session.undoableAction).toBeDefined()
    })

    it('S14 R-3.6 a map pawn with "off" sends: nothing waits in the panel', async () => {
        const turn = await atCards(['migrate', 'tax'], (state, { seat }) => {
            giveGood(state, seat, 'food')
        })
        const { session, seat } = turn
        await pressCard(session.actionPanel, 'migrate')
        expect(primaryLabels(session.actionPanel)).toEqual([])
        await pressTarget(session, pawnTarget(seat, 1))
        await settled(session)
        expect(lastByUser(turn)).toMatchObject({ type: ActionType.Migrate, onto: 'off' })
    })

    async function ruling(arrange?: Parameters<typeof atCards>[1]) {
        let spaceId: SpaceId = RoadEnd
        const turn = await atCards(['improve', 'tax'], (state, context) => {
            spaceId = emptySpace(state, 'town')
            placeMarker(state, context.seat, spaceId)
            state.recomputeRanks()
            giveSeal(state, context.seat)
            arrange?.(state, context)
        })
        return { ...turn, spaceId }
    }

    it('S15 R-3.9 the primary names the feudum and warns; only its press sends', async () => {
        const turn = await ruling()
        const { session, spaceId } = turn
        await pressCard(session.actionPanel, 'improve')
        await pressTarget(session, spaceTarget(spaceId))
        await pressPopup(session, 'Monk')
        expect(primaryLabels(session.actionPanel)[0]).toMatch(
            /^Improve .+ to a feudum · can't be undone$/
        )
        await sendNamed(session, /to a feudum/)
        expect(lastByUser(turn)).toMatchObject({ type: ActionType.Improve, revealsInfo: true })
    })

    it('S16 R-4.3.2 the panel says the tile is not legal before the press', async () => {
        const turn = await ruling((state) => {
            for (const stack of Object.values(state.regionStacks)) {
                stack.reverse()
            }
        })
        const { session } = turn
        await pressCard(session.actionPanel, 'improve')
        expect(linesOf(session.actionPanel, 'flow')).toEqual([
            expect.stringMatching(
                /^Pick a place you rule\. .* The .* tile is not yet legal: no earlier tile to take$/
            )
        ])
    })

    it('S17 R-3.9.3 the tiles as rows, a space, and the popup that sends', async () => {
        const spaces: SpaceId[] = []
        const turn = await atCards(['improve', 'tax'], (state, { seat, other }) => {
            const spaceId = emptySpace(state, 'outpost')
            spaces.push(spaceId)
            placeMarker(state, other, spaceId)
            placeMarker(state, seat, spaceId)
            state.recomputeRanks()
            giveGood(state, seat, 'wood')
            giveTile(state, seat)
            giveTile(state, seat)
        })
        const { session } = turn
        await pressCard(session.actionPanel, 'improve')
        const tiles = rowsOf(session.actionPanel, 'flow')
        expect(tiles.length).toBe(2)
        await pressRow(tiles[1])
        await pressTarget(session, spaceTarget(spaces[0]))
        await pressPopup(session, /^Collect \d+ .* · 1 to the ruler$/)
        await settled(session)
        expect(lastByUser(turn)).toMatchObject({ type: ActionType.TendLandscape })
    })
})

/** R-3.10.1 A seat ruling an outpost and a feudum sends its Explore, and is asked to keep. */
async function explored(arrange?: (state: HydratedFeudumGameState, seat: string) => void) {
    const table = hold(
        await seatedAtCards(['explore', 'tax'], (state, { seat }) => {
            placeMarker(state, seat, emptySpace(state, 'outpost'))
            buildFeudum(state, seat, emptySpace(state, 'farm'))
            state.recomputeRanks()
            returnGoods(state, seat)
            arrange?.(state, seat)
        })
    )
    await pressCard(table.session.actionPanel, 'explore')
    expect(primaryLabels(table.session.actionPanel)).toEqual([
        `Explore: draw 3 of ${writDeckCount(table.session.gameState)} writs · can't be undone`
    ])
    await sendNamed(table.session, /^Explore/)
    return table
}

describe('R-4.6 the staged moves of a guild function, in the tray', () => {
    async function pushing() {
        const table = await atGuild((state, { seat }) => {
            setMaster(state, seat, 'merchant')
            setMarket(state, { saltpeter: 3, sulfur: 3, iron: 1, wood: 3, food: 3 })
        })
        const { session } = table
        await pressCard(session.actionPanel, 'guild')
        if (session.guild.value('guild') !== 'merchant') {
            await pressTarget(session, guildTarget('merchant'))
        }
        await pressPopup(session, /^Push/)
        return session
    }

    async function pressBench(session: FeudumGameSession, id: string) {
        const item = session.guildPanel?.bench?.items.find((row) => row.id === id)
        assertExists(item, `The bench holds ${id}`)
        await session.pressTurnChoice(item)
        flushSync()
    }

    const staged = (session: FeudumGameSession) =>
        session.actionPanel.blocks.find(
            (block): block is Extract<ActionBlock, { kind: 'staged' }> => block.kind === 'staged'
        )

    it('each staged move is a line: the good as its piece with its count, where it goes, and the running count against the limit', async () => {
        const session = await pushing()
        expect(staged(session)).toBeUndefined()

        await pressBench(session, 'good:sulfur')
        await pressBench(session, 'good:sulfur')
        await pressBench(session, 'good:iron')

        const block = staged(session)
        assertExists(block, 'The tray lists the staged moves')
        expect(block.tally).toBe('3 of 4 moved')
        expect(block.lines.map(({ text, words, piece }) => ({ text, words, piece }))).toEqual([
            {
                text: '2 sulfur · Merchant → Alchemist',
                words: '2 sulfur from the Merchant to the Alchemist',
                piece: { kind: 'good', good: 'sulfur' }
            },
            {
                text: '1 iron · Merchant → Alchemist',
                words: '1 iron from the Merchant to the Alchemist',
                piece: { kind: 'good', good: 'iron' }
            }
        ])
        expect(block.lines.map(({ takeBack }) => takeBack.choice.label)).toEqual([
            'Take back 2 sulfur from the Merchant to the Alchemist',
            'Take back 1 iron from the Merchant to the Alchemist'
        ])
        // R-X.2 Short of the push's count, the send is not drawn; the draft still names it.
        expect(primaryLabels(session.actionPanel)).toEqual([])
        expect(session.guildPanel?.primary).toEqual({ label: 'Move 3 goods', enabled: false })
    })

    it('a line’s take-back removes only that move; Undo takes the take-back back', async () => {
        const session = await pushing()
        await pressBench(session, 'good:sulfur')
        await pressBench(session, 'good:iron')
        await pressBench(session, 'good:sulfur')

        const sulfur = staged(session)?.lines[0]
        assertExists(sulfur, 'The sulfur line')
        await pressRow(sulfur.takeBack)

        const block = staged(session)
        expect(block?.lines.map(({ text }) => text)).toEqual(['1 iron · Merchant → Alchemist'])
        expect(block?.tally).toBe('1 of 4 moved')
        expect(primaryLabels(session.actionPanel)).toEqual([])
        expect(session.guildPanel?.primary?.label).toBe('Move 1 good')

        await session.undo()
        flushSync()
        expect(staged(session)?.lines.map(({ text }) => text)).toEqual([
            '2 sulfur · Merchant → Alchemist',
            '1 iron · Merchant → Alchemist'
        ])
    })
})

describe('Explore, Harvest, Tax, Repeat, Defend', () => {
    it('S18 R-4.4.1 writ faces, one pick, the keep button, the Shovels & Swords button; no Undo', async () => {
        const table = await explored((state, seat) => {
            giveGood(state, seat, 'iron')
        })
        const { session, other } = table
        const view = () => session.actionPanel
        expect(linesOf(view())).toEqual(['Keep 1 of 3'])
        const writs = blockOf(view(), 'writs')?.rows
        expect(writs).toHaveLength(3)
        // R-X.2 No send until a writ is picked.
        expect(primaryLabels(view())).toEqual([])
        await writs?.[0].press()
        flushSync()
        expect(blockOf(view(), 'writs')?.rows[0].choice.picked).toBe(true)
        expect(primaryLabels(view())).toEqual([
            'Keep 1 · 2 under the deck',
            "Keep, then Shovels & Swords · 1 iron · draw 2 more · can't be undone"
        ])
        expect(session.undoableAction).toBeUndefined()
        const watcher = await table.host.openSeat(other)
        expect(blockOf(watcher.actionPanel, 'writs')).toBeUndefined()
        expect(linesOf(watcher.actionPanel, 'waiting')[0]).toBe(
            `Waiting on ${watcher.getPlayerName(session.myPlayerId ?? '')}.`
        )
        await sendNamed(session, 'Keep 1 · 2 under the deck')
        expect(lastByUser(table)).toMatchObject({ type: ActionType.KeepWrits })
        expect(lastByUser(table)?.revealsInfo).toBeFalsy()
    })

    it('S19 R-3.10.2 the second keep has no Shovels & Swords button', async () => {
        const table = await explored((state, seat) => {
            giveGood(state, seat, 'iron')
        })
        const { session } = table
        await blockOf(session.actionPanel, 'writs')?.rows[0].press()
        flushSync()
        await sendNamed(session, /^Keep, then Shovels & Swords/)
        expect(lastByUser(table)).toMatchObject({
            type: ActionType.KeepWrits,
            shovelsAndSwords: true,
            revealsInfo: true
        })
        expect(linesOf(session.actionPanel)).toEqual(['Keep 1 of 2'])
        await blockOf(session.actionPanel, 'writs')?.rows[0].press()
        flushSync()
        expect(primaryLabels(session.actionPanel)).toEqual(['Keep 1 · 1 under the deck'])
    })

    async function ruledFarm(arrange?: (state: HydratedFeudumGameState, seat: string) => void) {
        let spaceId: SpaceId = RoadEnd
        const turn = await atCards(['harvest', 'tax'], (state, { seat }) => {
            spaceId = emptySpace(state, 'farm')
            placeMarker(state, seat, spaceId)
            arrange?.(state, seat)
        })
        await pressCard(turn.session.actionPanel, 'harvest')
        await pressTarget(turn.session, spaceTarget(spaceId))
        return { ...turn, spaceId }
    }

    it('S20 R-3.11 favours: the note in the popup, the primary that warns', async () => {
        const { session } = await ruledFarm((state, seat) => {
            giveBead(state, seat)
            giveBead(state, seat)
        })
        const favours = session.boardPopup?.choices.find(({ label }) => label.startsWith('Favours'))
        expect(favours?.note).toEqual({ kind: 'cost', label: 'your 2 beads turn to seals' })
        await pressPopup(session, /^Favours/)
        expect(primaryLabels(session.actionPanel)[0]).toMatch(/^Favours at .+ · can't be undone$/)
    })

    it('S21 R-3.11.3 the drawn goods, "Take N as favours", the picks; "No favours" sends null', async () => {
        const turn = await ruledFarm((state, seat) => {
            state.getPlayerState(seat).pawns[0].character = 'farmer'
        })
        const { session, seat } = turn
        await pressPopup(session, 'Inspect the harvest')
        await sendNamed(session, /^Inspect the harvest at .+ · can't be undone$/)
        const offer = chooseFavoursOffer(session.gameState, seat)
        assertExists(offer, 'The harvester is asked')
        expect(linesOf(session.actionPanel)[0]).toBe(`Take ${offer.favours} as favours`)
        expect(rowsOf(session.actionPanel, 'goods').every(({ art }) => art?.kind === 'good')).toBe(
            true
        )
        expect(rowLabels(session.actionPanel, 'answer')).toEqual(['No favours'])
        expect(session.undoableAction?.type).not.toBe(ActionType.Harvest)
        await pressRow(rowNamed(session.actionPanel, 'No favours'))
        await settled(session)
        expect(lastByUser(turn)).toMatchObject({ type: ActionType.ChooseFavours, favours: null })
    })

    it('S22 R-3.12-H1 Reinforcements is asked in rows; the button says the answer; Undo is offered', async () => {
        const turn = await atCards(['tax', 'guild'], (state, { seat }) => {
            state.getPlayerState(seat).pawns[0].character = 'knight'
            ruleTown(state, seat)
        })
        const { session } = turn
        await pressCard(session.actionPanel, 'tax')
        expect(rowLabels(session.actionPanel, 'flow')).toEqual([
            'Collect Reinforcements · +1 marker',
            'Decline Reinforcements'
        ])
        await pressRow(rowNamed(session.actionPanel, 'Collect Reinforcements · +1 marker'))
        expect(primaryLabels(session.actionPanel)[0]).toMatch(
            /^Tax · \+\d+s · Reinforcements \+1 marker$/
        )
        await sendNamed(session, /^Tax/)
        expect(lastByUser(turn)).toMatchObject({ type: ActionType.Tax, collect: true })
        expect(session.undoableAction).toBeDefined()
    })

    it('S23 R-3.15 the replays, Déjà Vu in rose, hover lights what a replay would', async () => {
        const turn = await atCards(['repeat', 'tax'], (state, { seat }) => {
            state
                .getPlayerState(seat)
                .played.push(
                    { kind: 'move', use: 'regular' },
                    { kind: 'explore', use: 'regular' },
                    { kind: 'conquer', use: 'forfeited' }
                )
            ruleOutpost(state, seat)
        })
        const { session, seat } = turn
        await pressCard(session.actionPanel, 'repeat')
        const replays = rowsOf(session.actionPanel, 'replays')
        expect(replays.map(({ choice }) => choice.label).sort()).toEqual(['Explore', 'Move'])
        const move = rowNamed(session.actionPanel, 'Move')
        expect(move.choice.note).toBeUndefined()
        expect(rowNamed(session.actionPanel, 'Explore').choice.note).toEqual({
            kind: 'cost',
            label: 'Déjà Vu · 1 saltpeter'
        })
        expect(move.choice.lights?.()).toContain(pawnTarget(seat, 1))
        await pressRow(move)
        expect(session.turn.mode).toBe(ActionType.Move)
        expect(linesOf(session.actionPanel, 'flow')[0]).toMatch(/^Moves left/)
    })

    it('S24 R-3.14.1 one press sends: "Play Defend · +1 vp"', async () => {
        const turn = await atCards(['defend', 'tax'])
        const { session } = turn
        await pressCard(session.actionPanel, 'defend')
        expect(primaryLabels(session.actionPanel)).toEqual(['Play Defend · +1 vp'])
        await sendNamed(session, /^Play Defend/)
        expect(lastByUser(turn)).toMatchObject({ type: ActionType.PlayDefend })
    })
})

describe('Conquer', () => {
    it('R-4.8 the tally by source, its note, and the ask that names itself', async () => {
        let spaceId: SpaceId = RoadEnd
        const turn = await atCards(
            ['conquer', 'tax', 'move'],
            (state, { seat, other }) => {
                spaceId = emptySpace(state, 'outpost')
                addPawn(state, seat, 'knight', spaceId)
                addPawn(state, other, 'knight', spaceId)
            },
            { otherCards: ['tax', 'guild'] }
        )
        const { session, other } = turn
        await pressCard(session.actionPanel, 'conquer')
        const pawn = session.gameState
            .getPlayerState(other)
            .pawns.find((row) => row.spaceId === spaceId)
        assertExists(pawn, 'The defender stands there')
        await pressTarget(session, pawnTarget(other, pawn.n))
        const tally = blockOf(session.actionPanel, 'tally')
        expect(tally?.lines.find(({ source }) => source === 'total')).toBeDefined()
        expect(tally?.note).toBe('Defence may rise by 1 if they answer')
    })
})

describe('Move', () => {
    function stand(
        state: HydratedFeudumGameState,
        playerId: string,
        ...spaces: readonly SpaceId[]
    ) {
        state.getPlayerState(playerId).pawns.forEach((pawn, index) => {
            const spaceId = spaces.at(index)
            if (index >= spaces.length || !spaceId) {
                delete pawn.spaceId
                delete pawn.character
                return
            }
            pawn.spaceId = spaceId
            pawn.character = 'farmer'
        })
    }

    it('S25 R-3.7.1 the count falls with each step; "Stop moving" is offered', async () => {
        const turn = await atCards(['move', 'tax'], (state, { seat }) => {
            stand(state, seat, Inland, 'space.forest.1')
        })
        const { session, seat } = turn
        await pressCard(session.actionPanel, 'move')
        expect(linesOf(session.actionPanel, 'flow')).toEqual(['Moves left: 2 of 2'])
        expect(rowLabels(session.actionPanel, 'move')).toEqual(['Stop moving'])
        await pressTarget(session, pawnTarget(seat, 1))
        await pressTarget(session, spaceTarget(RoadEnd))
        expect(linesOf(session.actionPanel, 'flow')).toEqual(['Moves left: 1 of 2'])
        await session.undo()
        flushSync()
        expect(linesOf(session.actionPanel, 'flow')).toEqual(['Moves left: 2 of 2'])
    })

    it('S26 R-4.2 a way popup holds the panel: its rows wait for the answer', async () => {
        const turn = await atCards(['move', 'tax'], (state, { seat }) => {
            stand(state, seat, Inland)
        })
        const { session } = turn
        await pressCard(session.actionPanel, 'move')
        expect(session.movePanel?.popup).toBeUndefined()
        expect(rowsOf(session.actionPanel, 'move').length).toBeGreaterThan(0)
    })

    it('S29, S30 the last step opens the pilfer; "No pilfer" and the primary that names it', async () => {
        const turn = await atCards(['move', 'tax'], (state, { seat }) => {
            stand(state, seat, Inland)
            state.spaces[RoadEnd].location.kind = 'outpost'
            state.supply.haversack.iron -= 1
            state.spaces[RoadEnd].goods.iron += 1
        })
        const { session } = turn
        await pressCard(session.actionPanel, 'move')
        await pressTarget(session, spaceTarget(RoadEnd))
        expect(linesOf(session.actionPanel, 'flow')).toEqual(['Moves left: 0 of 1'])
        expect(rowLabels(session.actionPanel, 'move')).toEqual(['No pilfer'])
        const pilfer = [...session.boardOffer.targets.keys()].find((target) =>
            target.startsWith('pilfer:')
        )
        assertExists(pilfer, 'The iron may be pilfered')
        await pressTarget(session, pilfer)
        expect(primaryLabels(session.actionPanel)).toEqual(['Move · 1 step · pilfer 1 iron'])
        await sendNamed(session, /^Move/)
        expect(lastByUser(turn)).toMatchObject({ type: ActionType.Move })
        expect(session.undoableAction).toBeDefined()
    })

    it('S31 R-3.7.5 the voyage question, its Place button and what the disc costs in discs', async () => {
        const table = hold(await atDisc((playerId) => ({ kind: 'voyage', playerId })))
        const { session } = table
        expect(linesOf(session.actionPanel)).toEqual([
            'Place your voyage disc on space 1?',
            'Free discs: 3 of 3'
        ])
        expect(rowLabels(session.actionPanel, 'disc')[0]).toBe('Place')
        expect(primaryLabels(session.actionPanel)).toEqual([])
    })

    it('S31 R-3.7.5 with a disc on 1, the line warns and the press stages for the primary', async () => {
        const table = hold(
            await atDisc(
                (playerId) => ({ kind: 'voyage', playerId }),
                (state, { seat }) => {
                    state.voyageTrack[seat] = 1
                }
            )
        )
        const { session } = table
        expect(linesOf(session.actionPanel)[0]).toBe(
            "Advance to 2? draws 2 writs · can't be undone"
        )
        await pressRow(rowNamed(session.actionPanel, 'Advance to 2'))
        expect(primaryLabels(session.actionPanel)).toEqual(["Advance to 2 · can't be undone"])
    })
})

/** A row of the list: how a seat comes to the press, and which label it reads there. */
interface Reveal {
    /** The logic's file that sets `revealsInfo`, named for the scan beside this spec. */
    readonly file: string
    readonly variant: string
    readonly type: ActionType
    readonly reach: () => Promise<{
        readonly table: { readonly host: FeudumHost }
        readonly label: string
        readonly press: () => Promise<void>
    }>
}

/** The press on the primary this panel holds, its label carrying the warning. */
/** What the send reads: its label, and its second line where it has one. */
function primaryPress(session: FeudumGameSession, label: RegExp) {
    const primary = primaryNamed(session.actionPanel, label)
    return {
        label: primary.note ? `${primary.label} · ${primary.note}` : primary.label,
        press: async () => {
            await primary.send()
            await settled(session)
        }
    }
}

async function guildPress(
    arrange: GuildArrange,
    guildId: Parameters<typeof guildTarget>[0],
    fn: RegExp,
    items: readonly string[] = []
) {
    const table = await atGuild(arrange)
    const { session } = table
    await pressCard(session.actionPanel, 'guild')
    if (session.guild.value('guild') !== guildId) {
        await pressTarget(session, guildTarget(guildId))
    }
    await pressPopup(session, fn)
    for (const id of items) {
        const item = session.guildPanel?.bench?.items.find((row) => row.id === id)
        assertExists(item, `The bench holds ${id}`)
        await session.pressTurnChoice(item)
        flushSync()
    }
    return { table, ...primaryPress(session, /can't be undone/) }
}

/** R-4.6.3 A barn at its limit: all the goods sent are surplus. */
const BarnFull = FarmerBarn.capacity

const R1C1 = 'guild.noble.scroll.r1c1'
const R1C2 = 'guild.noble.scroll.r1c2'

const Reveals: readonly Reveal[] = [
    {
        file: 'finaliseHand',
        variant: 'the hand',
        type: ActionType.FinaliseHand,
        reach: async () => {
            const table = await atHands()
            const session = await table.openSeat(table.order[0])
            for (const kind of FourCards) {
                await pressCard(session.actionPanel, kind)
            }
            return { table: { host: table }, ...primaryPress(session, /^Long live the king/) }
        }
    },
    {
        file: 'explore',
        variant: 'the draw',
        type: ActionType.Explore,
        reach: async () => {
            const table = hold(
                await seatedAtCards(['explore', 'tax'], (state, { seat }) => {
                    placeMarker(state, seat, emptySpace(state, 'outpost'))
                    state.recomputeRanks()
                })
            )
            await pressCard(table.session.actionPanel, 'explore')
            return { table, ...primaryPress(table.session, /^Explore/) }
        }
    },
    ...(
        [
            ['a plain harvest', /^Harvest \d+$/, undefined],
            ['favours', /^Favours/, undefined],
            ['inspect', 'Inspect the harvest', 'farmer']
        ] as const
    ).map(([variant, popup, character]): Reveal => ({
        file: 'harvest',
        variant,
        type: ActionType.Harvest,
        reach: async () => {
            let spaceId: SpaceId = RoadEnd
            const table = await atCards(['harvest', 'tax'], (state, { seat }) => {
                spaceId = emptySpace(state, 'farm')
                placeMarker(state, seat, spaceId)
                if (character) {
                    state.getPlayerState(seat).pawns[0].character = character
                }
            })
            const { session } = table
            await pressCard(session.actionPanel, 'harvest')
            await pressTarget(session, spaceTarget(spaceId))
            await pressPopup(session, popup)
            return { table, ...primaryPress(session, / at /) }
        }
    })),
    {
        file: 'improve',
        variant: 'a tile taken',
        type: ActionType.Improve,
        reach: async () => {
            let spaceId: SpaceId = RoadEnd
            const table = await atCards(['improve', 'tax'], (state, { seat }) => {
                spaceId = emptySpace(state, 'town')
                placeMarker(state, seat, spaceId)
                giveSeal(state, seat)
            })
            const { session } = table
            await pressCard(session.actionPanel, 'improve')
            await pressTarget(session, spaceTarget(spaceId))
            await pressPopup(session, 'Monk')
            return { table, ...primaryPress(session, /^Improve/) }
        }
    },
    {
        file: 'conquer',
        variant: 'the defender is asked',
        type: ActionType.Conquer,
        reach: async () => {
            let spaceId: SpaceId = RoadEnd
            const table = await atCards(
                ['conquer', 'tax', 'move'],
                (state, { seat, other }) => {
                    spaceId = emptySpace(state, 'outpost')
                    addPawn(state, seat, 'knight', spaceId)
                    addPawn(state, other, 'knight', spaceId)
                },
                { otherCards: ['tax', 'guild'] }
            )
            const { session, other } = table
            await pressCard(session.actionPanel, 'conquer')
            const pawn = session.gameState
                .getPlayerState(other)
                .pawns.find((row) => row.spaceId === spaceId)
            assertExists(pawn, 'The defender stands there')
            await pressTarget(session, pawnTarget(other, pawn.n))
            return { table, ...primaryPress(session, /^Conquer/) }
        }
    },
    {
        file: 'starveThePeople',
        variant: 'the owner is asked',
        type: ActionType.StarveThePeople,
        reach: async () => {
            const table = await starving()
            return { table, ...primaryPress(table.session, /^Starve/) }
        }
    },
    ...(
        [
            ['flips Defend', true, /^Flip Defend/],
            ['lets it stand', false, /^Let it stand/]
        ] as const
    ).map(([variant, flip, words]): Reveal => ({
        file: 'answerAttack',
        variant,
        type: ActionType.AnswerAttack,
        reach: async () => {
            const { table, defender } = await defended()
            const panel = defender.answerAttackPanel
            const label = flip ? panel?.flip?.label : panel?.letStand.label
            assertExists(label, 'The defender is asked')
            expect(label).toMatch(words)
            return {
                table,
                label,
                press: async () => {
                    await defender.answerAttack(flip)
                    await settled(defender)
                }
            }
        }
    })),
    ...(
        [
            ['Royal Immunity', true],
            ['lets it go', false]
        ] as const
    ).map(([variant, immunity]): Reveal => ({
        file: 'answerStarve',
        variant,
        type: ActionType.AnswerStarve,
        reach: async () => {
            const table = await starving()
            const { session, other } = table
            const answerer = await table.host.openSeat(other)
            await primaryNamed(session.actionPanel, /^Starve/).send()
            await settled(session)
            await settled(answerer)
            const panel = answerer.answerStarvePanel
            const label = immunity ? panel?.immunity?.label : panel?.letGo.label
            assertExists(label, 'The owner is asked')
            return {
                table,
                label,
                press: async () => {
                    await answerer.answerStarveWith(immunity)
                    await settled(answerer)
                }
            }
        }
    })),
    {
        file: 'guildAction',
        variant: 'a Merchant pull reaches a threshold',
        type: ActionType.GuildAction,
        reach: () =>
            guildPress(
                (state, { seat, other }) => {
                    setJourneyman(state, seat, 'merchant', other)
                    setBarn(state, { iron: 2, wood: 1 })
                    setMarket(state, { saltpeter: 3, sulfur: 3, iron: 1, wood: 3, food: 3 })
                },
                'merchant',
                /^Pull/,
                ['good:iron', 'good:iron', 'good:wood']
            )
    },
    {
        file: 'guildAction',
        variant: 'a Monk trade draws a hidden bead',
        type: ActionType.GuildAction,
        reach: () =>
            guildPress(
                (state, { seat }) => {
                    setBeads(state, { rosary: [5, 2], chickens: [] })
                    setShillings(state, seat, 9)
                },
                'monk',
                /^Trade/
            )
    },
    {
        file: 'guildAction',
        variant: 'a Farmer pull draws a hidden bead',
        type: ActionType.GuildAction,
        reach: () =>
            guildPress(
                (state, { seat, other }) => {
                    setJourneyman(state, seat, 'farmer', other)
                    setBeads(state, { rosary: [5, 2], chickens: [3] })
                },
                'farmer',
                /^Pull/
            )
    },
    {
        file: 'guildAction',
        variant: 'a Monk push draws a hidden bead',
        type: ActionType.GuildAction,
        reach: () =>
            guildPress(
                (state, { seat }) => {
                    setMaster(state, seat, 'monk')
                    setBeads(state, { rosary: [5, 2], chickens: [] })
                    state.supply.shillings -= 2
                    state.guilds.monk.coffer = 2
                },
                'monk',
                /^Push/
            )
    },
    {
        file: 'guildAction',
        variant: "a Farmer trade over the barn's limit spills at random",
        type: ActionType.GuildAction,
        reach: async () => {
            const farms: SpaceId[] = []
            const table = await atGuild((state, { seat }) => {
                farms.push(ruleFarm(state, seat, { food: 4 }), ruleFarm(state, seat, { food: 4 }))
                setBarn(state, { wood: BarnFull })
                setBeads(state, { rosary: [5, 2], chickens: [3] })
            })
            const { session } = table
            await pressCard(session.actionPanel, 'guild')
            if (session.guild.value('guild') !== 'farmer') {
                await pressTarget(session, guildTarget('farmer'))
            }
            await pressPopup(session, /^Trade/)
            await pressTarget(session, spaceTarget(farms[0]))
            await pressPopup(session, /^4 sent: 0 food/)
            return { table, ...primaryPress(session, /can't be undone/) }
        }
    },
    {
        file: 'guildAction',
        variant: 'a Monk pull flips a seal',
        type: ActionType.GuildAction,
        reach: () =>
            guildPress(
                (state, { seat, other }) => {
                    setJourneyman(state, seat, 'monk', other)
                    setScrolls(state, [R1C1, R1C2])
                },
                'monk',
                /^Pull/,
                [`scroll:${R1C2}`]
            )
    },
    {
        file: 'guildAction',
        variant: 'a Noble push flips seals',
        type: ActionType.GuildAction,
        reach: () =>
            guildPress(
                (state, { seat }) => {
                    setMaster(state, seat, 'noble')
                    setScrolls(state, [R1C1, R1C2])
                },
                'noble',
                /^Push/,
                [`scroll:${R1C1}`, `scroll:${R1C2}`]
            )
    },
    {
        file: 'feast',
        variant: 'a Monk push at a Feast',
        type: ActionType.Feast,
        reach: async () => {
            const table = await atGuild((state, { seat, other }) => {
                setPawns(state, seat, ['knight', 'knight'])
                state.supply.haversack.sulfur -= 1
                state.getPlayerState(seat).barrel = 1
                setMaster(state, other, 'monk')
                setBeads(state, { rosary: [5, 2], chickens: [] })
                state.supply.shillings -= 2
                state.guilds.monk.coffer = 2
                const [, second] = state.getPlayerState(seat).pawns
                const [, otherSecond] = state.getPlayerState(other).pawns
                assertExists(second, 'The seat has a second pawn')
                assertExists(otherSecond, 'The opponent has a second pawn')
                second.spaceId = RoadEnd
                otherSecond.spaceId = RoadEnd
            })
            const { session } = table
            await pressCard(session.actionPanel, 'guild')
            await pressRow(rowNamed(session.actionPanel, /^Feast/))
            await pressTarget(session, spaceTarget(StandingSpace))
            await pressPopup(session, /Monk push/)
            return { table, ...primaryPress(session, /can't be undone/) }
        }
    },
    {
        file: 'keepWrits',
        variant: 'with Shovels & Swords',
        type: ActionType.KeepWrits,
        reach: async () => {
            const table = await explored((state, seat) => {
                giveGood(state, seat, 'iron')
            })
            await blockOf(table.session.actionPanel, 'writs')?.rows[0].press()
            flushSync()
            return { table, ...primaryPress(table.session, /^Keep, then/) }
        }
    },
    ...[1, 3, 5].map((from): Reveal => ({
        file: 'placeDisc',
        variant: `voyage space ${from + 1}`,
        type: ActionType.PlaceDisc,
        reach: async () => {
            const table = hold(
                await atDisc(
                    (playerId) => ({ kind: 'voyage', playerId }),
                    (state, { seat }) => {
                        state.voyageTrack[seat] = from
                    }
                )
            )
            const { session } = table
            expect(linesOf(session.actionPanel)[0]).toContain(CantBeUndone)
            await pressRow(rowNamed(session.actionPanel, `Advance to ${from + 1}`))
            return { table, ...primaryPress(session, /^Advance/) }
        }
    })),
    {
        file: 'playMandate',
        variant: 'it draws goods',
        type: ActionType.PlayMandate,
        reach: async () => {
            const table = hold(
                await seatedAtCards(['tax', 'move', 'guild'], (state, { seat }) => {
                    returnGoods(state, seat)
                    holdWrit(state, seat, 'writ.mandate.6')
                    threePawns(state, seat)
                    for (const pawn of state.getPlayerState(seat).pawns) {
                        pawn.character = 'farmer'
                    }
                    state.recomputeRanks()
                })
            )
            const { session, seat } = table
            const revealing = playMandateOffers(session.gameState, seat).find(
                (offer) => offer.revealsInfo && !offer.refused
            )
            assertExists(revealing, 'R-4.4-H4 Three goods from the supply show what they are')
            await session.pressDraftChoice(
                session.atWillPanel?.chips.find(({ list }) => list === 'writs') ?? {}
            )
            flushSync()
            const choice = session.atWillPanel?.writs?.find(
                ({ writId }) => writId === revealing.writId
            )?.choices[revealing.alternative]
            assertExists(choice, 'The writ offers this alternative')
            await session.pressDraftChoice(choice)
            flushSync()
            const label = session.atWillPanel?.primary?.label
            assertExists(label, 'It waits for the primary')
            return {
                table,
                label,
                press: async () => {
                    await session.sendFollowUp()
                    await settled(session)
                }
            }
        }
    }
]

async function starving() {
    let spaceId: SpaceId = RoadEnd
    const table = hold(
        await seatedAtCards(
            ['conquer', 'tax', 'move'],
            (state, { seat, other }) => {
                spaceId = emptySpace(state, 'outpost')
                addPawn(state, seat, 'noble', spaceId)
                placeMarker(state, seat, spaceId)
                placeMarker(state, other, spaceId)
                state.recomputeRanks()
                holdFood(state, other, 1)
            },
            { otherCards: ['defend', 'tax'] }
        )
    )
    const { session, other } = table
    await pressCard(session.actionPanel, 'conquer')
    await pressRow(rowNamed(session.actionPanel, 'Starve the People'))
    await pressTarget(session, markerTarget(spaceId, other, 'serf'))
    return table
}

/** Ana conquers; Ben is asked, and may flip Defend. */
async function defended() {
    let spaceId: SpaceId = RoadEnd
    const table = hold(
        await seatedAtCards(
            ['conquer', 'tax', 'move'],
            (state, { seat, other }) => {
                spaceId = emptySpace(state, 'outpost')
                addPawn(state, seat, 'knight', spaceId)
                addPawn(state, other, 'knight', spaceId)
                state.recomputeRanks()
            },
            { otherCards: ['defend', 'tax'] }
        )
    )
    const { session, other } = table
    const defender = await table.host.openSeat(other)
    await pressCard(session.actionPanel, 'conquer')
    const pawn = session.gameState
        .getPlayerState(other)
        .pawns.find((row) => row.spaceId === spaceId)
    assertExists(pawn, 'The defender stands there')
    await pressTarget(session, pawnTarget(other, pawn.n))
    await primaryNamed(session.actionPanel, /^Conquer/).send()
    await settled(session)
    await settled(defender)
    return { table, defender }
}

/** The Action files whose `revealsInfo` no seat's press sets: the machine plays them. */
const SystemRevealers = [
    'replenishGuilds',
    'replenishMap',
    'revealPouches',
    'rollProgressDie',
    'scoreGame'
]

describe("R-X.2 every send that can't be undone names itself: the list, not a sample", () => {
    it('the list holds every Action in the logic that can set revealsInfo', () => {
        const actions = join(process.cwd(), '../feudum/src/actions')
        const revealers = readdirSync(actions)
            .filter((name) => name.endsWith('.ts') && !name.endsWith('.spec.ts'))
            .filter((name) => /revealsInfo\s*(:|=)/.test(readFileSync(join(actions, name), 'utf8')))
            .map((name) => name.replace(/\.ts$/, ''))
            .sort()
        const listed = [...new Set(Reveals.map(({ file }) => file)), ...SystemRevealers].sort()
        expect(revealers).toEqual(listed)
    })

    it.each(Reveals.map((row) => [row.file, row.variant, row] as const))(
        '%s: %s',
        async (_file, _variant, { type, reach }) => {
            const { table, label, press } = await reach()
            expect(label).toContain(CantBeUndone)
            const before = table.host.actions.length
            await press()
            expect(table.host.actions.length).toBeGreaterThan(before)
            expect(lastByUser(table)).toMatchObject({ type, revealsInfo: true })
        }
    )

    it('an Improve that takes the fallback tile says so too', async () => {
        const table = await atCards(['improve', 'tax'], (state, { seat }) => {
            const spaceId = emptySpace(state, 'town')
            placeMarker(state, seat, spaceId)
            giveSeal(state, seat)
            state.epoch = 3
            const home = Object.entries(state.regionStacks).find(([region]) =>
                spaceId.includes(region.replace('region.', ''))
            )
            home?.[1].reverse()
        })
        const { session } = table
        await pressCard(session.actionPanel, 'improve')
        const [{ target }] = session.turn.flow?.picks ?? []
        await pressTarget(session, target)
        await pressPopup(session, 'Monk')
        const [stack] = session.turn.flow?.picks ?? []
        if (stack?.target.startsWith('stack:')) {
            await pressTarget(session, stack.target)
        }
        expect(primaryLabels(session.actionPanel)[0]).toContain(CantBeUndone)
        await sendNamed(session, /can't be undone/)
        expect(lastByUser(table)).toMatchObject({ type: ActionType.Improve, revealsInfo: true })
    })

    it('a send that can be undone never says it', async () => {
        const influence = await atCards(['influence', 'tax'], (state, { seat }) => {
            ruleOutpost(state, seat)
        })
        await pressCard(influence.session.actionPanel, 'influence')
        expect(primaryLabels(influence.session.actionPanel).join()).not.toContain(CantBeUndone)
        host?.close()

        const tax = await atCards(['tax', 'guild'], (state, { seat }) => {
            ruleTown(state, seat)
        })
        await pressCard(tax.session.actionPanel, 'tax')
        expect(primaryLabels(tax.session.actionPanel).join()).not.toContain(CantBeUndone)
        await sendNamed(tax.session, /^Tax/)
        expect(lastByUser(tax)?.revealsInfo).toBeFalsy()
        host?.close()

        const keep = await explored()
        await blockOf(keep.session.actionPanel, 'writs')?.rows[0].press()
        flushSync()
        expect(primaryLabels(keep.session.actionPanel)).toEqual(['Keep 1 · 2 under the deck'])
        host?.close()

        const voyage = hold(await atDisc((playerId) => ({ kind: 'voyage', playerId })))
        expect(linesOf(voyage.session.actionPanel).join()).not.toContain(CantBeUndone)
    })
})
