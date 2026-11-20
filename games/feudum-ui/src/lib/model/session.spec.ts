import { flushSync } from 'svelte'
import { assertExists } from '@tabletop/common'
import { GameSession } from '@tabletop/frontend-components'
import {
    ActionType,
    dummyRowColour,
    type Good,
    knightRows,
    MachineState,
    StartingSpaceIds
} from '@tabletop/feudum'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FeudumHost } from '$lib/testing/sessionHarness.js'
import { primaryLabel, sendsOnPress } from './confirmingSend.js'
import { colourPaint, seatPaint } from './seatPaint.js'
import { StagedDraft, withLoneChoice } from './stagedDraft.svelte.js'
import {
    StartingGoodsDraft,
    StartingGoodsStageOrder,
    type StartingGoodsValues
} from './startingGoodsDraft.svelte.js'
import { StartingPawnDraft, type StartingPawnValues } from './startingPawnDraft.svelte.js'

const DESERT_3 = 'space.desert.3'
const AllGoods: readonly Good[] = ['saltpeter', 'sulfur', 'iron', 'wood', 'food']

let host: FeudumHost | undefined

function openTable(numPlayers = 4): FeudumHost {
    host = new FeudumHost(numPlayers)
    return host
}

beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined)
})

afterEach(() => {
    host?.close()
    host = undefined
    vi.restoreAllMocks()
})

function goodsDraft(offers: readonly Good[] = AllGoods) {
    return new StartingGoodsDraft(() => offers)
}

describe('staged-selection helpers', () => {
    it('a lone legal choice fills an empty stage as auto (contract: Pick conventions)', () => {
        expect(
            withLoneChoice<StartingPawnValues, 'first'>({}, ['first', 'second'], 'first', [
                { kind: 'space', spaceId: DESERT_3 }
            ])
        ).toEqual({ first: { value: { kind: 'space', spaceId: DESERT_3 }, source: 'auto' } })
    })

    it('leaves a filled stage alone, and two choices or none unfilled', () => {
        const kept = { goods: ['iron', 'wood', 'food'], sulfurTo: 'supply' } as const
        const filled = { pick: { value: kept, source: 'manual' } } as const
        expect(
            withLoneChoice<StartingGoodsValues, 'pick'>(filled, StartingGoodsStageOrder, 'pick', [
                kept
            ])
        ).toBe(filled)
        for (const choices of [[], [kept, { ...kept, sulfurTo: 'barrel' }]] as const) {
            expect(
                withLoneChoice<StartingGoodsValues, 'pick'>(
                    {},
                    StartingGoodsStageOrder,
                    'pick',
                    choices
                )
            ).toEqual({})
        }
    })
})

describe('confirming a send (R-X.2; contract: Confirming a send)', () => {
    it('a press that completes an undoable Action sends', () => {
        expect(sendsOnPress({ allManual: true })).toBe(true)
        expect(sendsOnPress({ allManual: true }, { revealsInfo: false })).toBe(true)
    })

    it('a lone legal choice never completes a send', () => {
        expect(sendsOnPress({ allManual: false })).toBe(false)
    })

    it('a preview that sets revealsInfo stages for a confirming press, and says so', () => {
        expect(sendsOnPress({ allManual: true }, { revealsInfo: true })).toBe(false)
        expect(primaryLabel('Long live the king', { revealsInfo: true })).toBe(
            "Long live the king · can't be undone"
        )
        expect(primaryLabel('Take iron, wood, food')).toBe('Take iron, wood, food')
    })
})

describe('StartingGoodsDraft (R-1.4.8): minimum tests', () => {
    it('the sulfur is kept unless the seat puts it into the barrel, as the logic takes it', () => {
        const draft = goodsDraft()
        draft.press('sulfur')
        expect(draft.asksSulfur).toBe(true)
        expect(draft.sulfurTo).toBe('supply')
    })

    it('Undo with a manual stage pops the latest press and takes no Action back', () => {
        const draft = goodsDraft()
        for (const good of ['sulfur', 'iron', 'food'] as const) draft.press(good)
        draft.chooseSulfurDestination('barrel')

        expect(draft.localSelection.undo()).toBe(true)

        expect(draft.sulfurTo).toBe('supply')
        expect(draft.goods).toEqual(['sulfur', 'iron', 'food'])
    })

    it('Undo with only an auto stage falls through to the Action undo', () => {
        const draft = goodsDraft(['iron', 'wood', 'food'])
        expect(draft.entry('pick')?.source).toBe('auto')
        expect(draft.localSelection.hasManual()).toBe(false)
        expect(draft.localSelection.undo()).toBe(false)
        expect(draft.goods).toEqual(['iron', 'wood', 'food'])
    })

    it('a stage the order lacks throws', () => {
        expect(() =>
            new StagedDraft<StartingPawnValues>(['first']).set('second', {
                kind: 'space',
                spaceId: DESERT_3
            })
        ).toThrow('does not exist in stage order')
    })

    it('the sulfur’s destination stays as other goods are picked and unpicked', () => {
        const draft = goodsDraft()
        for (const good of ['sulfur', 'iron', 'food'] as const) draft.press(good)
        draft.chooseSulfurDestination('barrel')
        expect(draft.ready).toBe(true)

        draft.press('food')
        draft.press('wood')

        expect(draft.goods).toEqual(['sulfur', 'iron', 'wood'])
        expect(draft.asksSulfur).toBe(true)
        expect(draft.sulfurTo).toBe('barrel')
        expect(draft.ready).toBe(true)
    })

    it('unpicking the sulfur drops its line; picked again, it is kept', () => {
        const draft = goodsDraft()
        draft.press('sulfur')
        draft.chooseSulfurDestination('barrel')
        draft.press('sulfur')
        expect(draft.asksSulfur).toBe(false)
        draft.press('sulfur')
        expect(draft.sulfurTo).toBe('supply')
    })
})

describe('StartingGoodsDraft (R-1.4.8): stacked stage', () => {
    it('Undo pops the latest press and keeps the earlier ones', () => {
        const draft = goodsDraft()
        for (const good of ['saltpeter', 'sulfur', 'food'] as const) draft.press(good)

        draft.localSelection.undo()

        expect(draft.goods).toEqual(['saltpeter', 'sulfur'])
    })

    it('Undo takes back one press at a time, a good or the destination', () => {
        const draft = goodsDraft()
        for (const good of ['sulfur', 'iron'] as const) draft.press(good)
        draft.chooseSulfurDestination('barrel')
        draft.press('food')

        draft.localSelection.undo()
        expect(draft.goods).toEqual(['sulfur', 'iron'])
        expect(draft.sulfurTo).toBe('barrel')

        draft.localSelection.undo()
        expect(draft.sulfurTo).toBe('supply')

        draft.localSelection.undo()
        expect(draft.goods).toEqual(['sulfur'])
    })

    it('a fourth good and a press on the destination already chosen change nothing', () => {
        const draft = goodsDraft()
        for (const good of ['saltpeter', 'sulfur', 'food'] as const) draft.press(good)
        draft.press('wood')
        draft.chooseSulfurDestination('supply')
        expect(draft.goods).toEqual(['saltpeter', 'sulfur', 'food'])
        draft.localSelection.undo()
        expect(draft.goods).toEqual(['saltpeter', 'sulfur'])
    })

    it('the destination is asked only of sulfur', () => {
        const draft = goodsDraft()
        draft.press('iron')
        draft.chooseSulfurDestination('barrel')
        expect(draft.sulfurTo).toBe('supply')
        expect(draft.asksSulfur).toBe(false)
    })
})

describe('StartingPawnDraft (R-1.4.9): minimum tests', () => {
    const knight = { kind: 'character', character: 'knight' } as const
    const farmer = { kind: 'character', character: 'farmer' } as const
    const desert = { kind: 'space', spaceId: DESERT_3 } as const

    it('setting a stage clears the stages after it', () => {
        const draft = new StartingPawnDraft()
        draft.press(knight)
        draft.press(desert)
        expect(draft.complete).toBe(true)

        draft.set('first', farmer)

        expect(draft.spaceId).toBeUndefined()
        expect(draft.character).toBe('farmer')
    })

    it('Undo with a manual stage pops the highest and takes no Action back', () => {
        const draft = new StartingPawnDraft()
        draft.press(knight)
        draft.press(desert)

        expect(draft.localSelection.undo()).toBe(true)

        expect(draft.spaceId).toBeUndefined()
        expect(draft.character).toBe('knight')
    })

    it('Undo with only an auto stage falls through to the Action undo', () => {
        const draft = new StartingPawnDraft()
        draft.set('first', knight, 'auto')

        expect(draft.localSelection.hasManual()).toBe(false)
        expect(draft.localSelection.undo()).toBe(false)
        expect(draft.character).toBe('knight')
    })

    it('a stage the order lacks throws', () => {
        expect(() => new StagedDraft<StartingPawnValues>(['first']).set('second', desert)).toThrow(
            'does not exist in stage order'
        )
    })

    it('reselecting: another of the same kind replaces it, Undo restores it, the same unpicks', () => {
        const draft = new StartingPawnDraft()
        draft.press(knight)
        draft.press(farmer)
        expect(draft.character).toBe('farmer')

        draft.localSelection.undo()
        expect(draft.character).toBe('knight')

        draft.press(knight)
        expect(draft.character).toBeUndefined()
    })

    it('holds character and space in either order', () => {
        const draft = new StartingPawnDraft()
        draft.press(desert)
        expect(draft.asksCharacter).toBe(true)
        draft.press(knight)
        expect(draft.spaceId).toBe(DESERT_3)
        expect(draft.character).toBe('knight')
        expect(draft.complete).toBe(true)
    })

    it('an auto stage never completes a send', () => {
        const draft = new StartingPawnDraft()
        draft.set('first', knight, 'auto')
        draft.press(desert)
        expect(draft.complete).toBe(true)
        expect(sendsOnPress(draft)).toBe(false)
    })
})

describe('the real session: S1, goods with the sulfur destination (R-1.4.8)', () => {
    it('picks, asks, names the three goods, undoes one press at a time, then sends', async () => {
        const table = openTable()
        const seat = table.setupSeat
        const session = await table.openSeat(seat)

        for (const good of ['saltpeter', 'sulfur', 'food'] as const) {
            session.pressStartingGood(good)
        }
        flushSync()
        expect(session.startingGoodsPanel?.sulfurTo).toBe('supply')
        expect(session.startingGoodsPanel?.primary).toEqual({
            label: 'Take saltpeter, sulfur, food',
            enabled: true
        })

        session.chooseSulfurDestination('barrel')
        flushSync()
        expect(session.startingGoodsPanel?.primary).toEqual({
            label: 'Take saltpeter, sulfur (barrel), food',
            enabled: true
        })

        await session.undo()
        expect(session.startingGoods.sulfurTo).toBe('supply')
        await session.undo()
        expect(session.startingGoods.goods).toEqual(['saltpeter', 'sulfur'])
        await session.undo()
        expect(session.startingGoods.goods).toEqual(['saltpeter'])
        expect(table.actions).toEqual([])

        session.pressStartingGood('sulfur')
        session.pressStartingGood('food')
        session.chooseSulfurDestination('barrel')
        await session.sendStartingGoods()
        await session.waitForVisibleTransitionSettled()

        expect(table.sent.get(seat)?.[0]).toMatchObject({
            type: ActionType.ChooseStartingGoods,
            goods: ['saltpeter', 'sulfur', 'food'],
            sulfurToBarrel: true
        })
        const player = session.gameState.getPlayerState(seat)
        expect(player.barrel).toBe(1)
        expect(player.goods.saltpeter).toBe(1)
        expect(session.startingGoods.hasManual).toBe(false)
    })

    it('sends nothing before the choice is whole', async () => {
        const table = openTable()
        const session = await table.openSeat(table.setupSeat)

        session.pressStartingGood('sulfur')
        session.pressStartingGood('iron')
        await session.sendStartingGoods()

        expect(table.actions).toEqual([])
    })

    it('the sulfur kept by default reaches the logic as kept', async () => {
        const table = openTable()
        const seat = table.setupSeat
        const session = await table.openSeat(seat)

        for (const good of ['sulfur', 'iron', 'food'] as const) session.pressStartingGood(good)
        await session.sendStartingGoods()
        await session.waitForVisibleTransitionSettled()

        const sent = table.sent.get(seat)?.[0]
        expect(sent).toMatchObject({ type: ActionType.ChooseStartingGoods })
        expect(sent).not.toHaveProperty('sulfurToBarrel')
        expect(session.gameState.getPlayerState(seat).goods.sulfur).toBe(1)
    })

    it('another seat sees counts and the waiting line, and has no draft', async () => {
        const table = openTable()
        const waiting = table.order.find((id) => id !== table.setupSeat) ?? ''
        const session = await table.openSeat(waiting)

        session.pressStartingGood('iron')
        flushSync()

        const panel = session.startingGoodsPanel
        expect(panel?.deciding).toBe(false)
        expect(panel?.deciderId).toBe(table.setupSeat)
        expect(panel).not.toHaveProperty('waitingLine')
        expect(session.startingGoods.goods).toEqual([])
        expect(panel?.goods.every(({ picked }) => !picked)).toBe(true)
    })

    it('a good the haversack has run out of is not drawn, and a press does nothing', async () => {
        const table = openTable()
        const seat = table.setupSeat
        const row = table.state.players.find(({ playerId }) => playerId === seat)
        assertExists(row, 'The seat has a row')
        row.goods.food += table.state.supply.haversack.food
        table.state.supply.haversack.food = 0
        const session = await table.openSeat(seat)

        session.pressStartingGood('food')
        flushSync()

        expect(session.startingGoods.goods).toEqual([])
        expect(session.startingGoodsPanel?.goods.find(({ good }) => good === 'food')?.refusal).toBe(
            'The haversack holds no food.'
        )
        const drawn = session.actionPanel.blocks.flatMap((block) =>
            block.kind === 'rows' && block.name === 'goods'
                ? block.rows.map(({ choice }) => choice.label)
                : []
        )
        expect(drawn).toHaveLength(4)
        expect(drawn.some((label) => label.startsWith('Food'))).toBe(false)
    })

    it('with three picked, a fourth is spent: dimmed, with no line', async () => {
        const table = openTable()
        const session = await table.openSeat(table.setupSeat)
        for (const good of ['saltpeter', 'iron', 'food'] as const) session.pressStartingGood(good)
        flushSync()

        const goods = session.startingGoodsPanel?.goods
        expect(goods?.find(({ good }) => good === 'wood')).toMatchObject({ spent: true })
        expect(goods?.find(({ good }) => good === 'wood')?.refusal).toBeUndefined()
        expect(goods?.find(({ good }) => good === 'iron')?.spent).toBeUndefined()
    })

    it('a lone legal pick is auto-selected and waits for the primary press', async () => {
        const table = openTable()
        const seat = table.setupSeat
        const row = table.state.players.find(({ playerId }) => playerId === seat)
        assertExists(row, 'The seat has a row')
        for (const good of ['saltpeter', 'sulfur'] as const) {
            row.goods[good] += table.state.supply.haversack[good]
            table.state.supply.haversack[good] = 0
        }
        const session = await table.openSeat(seat)

        expect(table.game.protectedInformation).toBe(true)
        expect(session.startingGoods.goods).toEqual(['iron', 'wood', 'food'])
        expect(session.startingGoods.entry('pick')?.source).toBe('auto')
        expect(session.hasLocalSelection).toBe(false)
        expect(table.actions).toEqual([])
        expect(session.startingGoodsPanel?.primary?.enabled).toBe(true)

        await session.sendStartingGoods()
        await session.waitForVisibleTransitionSettled()

        expect(table.sent.get(seat)?.[0]).toMatchObject({ goods: ['iron', 'wood', 'food'] })
    })

    it('with only a lone legal pick held, Undo goes through to the Action', async () => {
        const table = openTable()
        const seat = table.setupSeat
        const row = table.state.players.find(({ playerId }) => playerId === seat)
        assertExists(row, 'The seat has a row')
        for (const good of ['saltpeter', 'sulfur'] as const) {
            row.goods[good] += table.state.supply.haversack[good]
            table.state.supply.haversack[good] = 0
        }
        const session = await table.openSeat(seat)
        const undoAction = vi
            .spyOn(GameSession.prototype, 'undoCommittedAction')
            .mockResolvedValue()

        await session.undo()

        expect(undoAction).toHaveBeenCalledOnce()
        expect(session.startingGoods.goods).toEqual(['iron', 'wood', 'food'])
    })
})

describe('the real session: S2 and S3, the starting pawn (R-1.4.9, R-4.5)', () => {
    async function atPawns(table: FeudumHost, seatsPlaced = 0) {
        await table.playStartingGoods()
        await table.playStartingPawns(seatsPlaced)
        expect(table.state.machineState).toBe(MachineState.PlacingStartingPawn)
    }

    it('S2: character then space sends on the completing press', async () => {
        const table = openTable()
        await atPawns(table)
        const seat = table.setupSeat
        const session = await table.openSeat(seat)

        await session.pressStartingCharacter('knight')
        flushSync()
        expect(table.sent.get(seat)).toBeUndefined()
        expect(session.startingPawnPanel?.characters.find((c) => c.picked)?.rank).toBe('master')

        await session.pressStartingSpace(DESERT_3)
        await session.waitForVisibleTransitionSettled()

        expect(table.sent.get(seat)?.[0]).toMatchObject({
            type: ActionType.PlaceStartingPawn,
            character: 'knight',
            spaceId: DESERT_3
        })
        expect(session.gameState.machineState).toBe(MachineState.PlacingStartingPawn)
        expect(session.startingPawn.hasManual).toBe(false)
    })

    it('S2: space then character, with the popup, sends on the character', async () => {
        const table = openTable()
        await atPawns(table)
        const seat = table.setupSeat
        const session = await table.openSeat(seat)

        await session.pressStartingSpace(DESERT_3)
        flushSync()
        expect(session.startingPawnPanel?.asksCharacter).toBe(true)
        expect(session.startingPawnPanel?.pickedSpace).toBe(DESERT_3)

        await session.pressStartingCharacter('farmer')
        await session.waitForVisibleTransitionSettled()

        expect(table.sent.get(seat)?.[0]).toMatchObject({ character: 'farmer', spaceId: DESERT_3 })
    })

    it('S2: Undo before the send steps back one press and takes no Action back', async () => {
        const table = openTable()
        await atPawns(table)
        const session = await table.openSeat(table.setupSeat)
        const undoAction = vi.spyOn(GameSession.prototype, 'undoCommittedAction')

        await session.pressStartingCharacter('knight')
        await session.pressStartingCharacter('farmer')
        await session.undo()
        expect(session.startingPawn.character).toBe('knight')
        await session.undo()
        expect(session.startingPawn.character).toBeUndefined()

        expect(undoAction).not.toHaveBeenCalled()
    })

    it('after the send, Undo takes the Action back, and the seat chooses again', async () => {
        const table = openTable()
        await atPawns(table)
        const seat = table.setupSeat
        const session = await table.openSeat(seat)
        await session.pressStartingCharacter('knight')
        await session.pressStartingSpace(DESERT_3)
        await session.waitForVisibleTransitionSettled()
        expect(session.undoableAction).toBeDefined()

        await session.undo()
        await session.waitForVisibleTransitionSettled()

        expect(table.setupSeat).toBe(seat)
        expect(session.startingPawnPanel?.deciding).toBe(true)
        expect(session.startingPawn.hasManual).toBe(false)
    })

    it('a space off the six does nothing', async () => {
        const table = openTable()
        await atPawns(table)
        const session = await table.openSeat(table.setupSeat)
        const offTheSix = 'space.desert.1'
        expect(StartingSpaceIds.includes(offTheSix)).toBe(false)

        await session.pressStartingSpace(offTheSix)

        expect(session.startingPawn.spaceId).toBeUndefined()
    })

    it('S3: a later seat sees the rank left; once the track is full a Knight has none', async () => {
        const table = openTable(5)
        await atPawns(table)
        for (let placed = 0; placed < 4; placed += 1) {
            const seat = table.setupSeat
            const session = await table.openSeat(seat)
            const rank = session.startingPawnPanel?.characters.find(
                ({ character }) => character === 'knight'
            )?.rank
            expect(rank).toBe(['master', 'journeyman', 'apprentice', undefined][placed])
            await table.send(seat, {
                type: ActionType.PlaceStartingPawn,
                character: 'knight',
                spaceId: DESERT_3
            })
        }
        const session = await table.openSeat(table.setupSeat)
        expect(
            session.startingPawnPanel?.characters.find(({ character }) => character === 'knight')
                ?.rank
        ).toBeUndefined()
    })

    it('another seat has no press', async () => {
        const table = openTable()
        await atPawns(table)
        const waiting = table.order.find((id) => id !== table.setupSeat) ?? ''
        const session = await table.openSeat(waiting)

        await session.pressStartingSpace(DESERT_3)

        expect(session.startingPawn.spaceId).toBeUndefined()
        expect(session.startingPawnPanel?.deciding).toBe(false)
    })
})

describe('R-1.4.8, R-3.1 what a draft keeps across a transition (contract: Shared visual state)', () => {
    it('the goods draft ends with the displayed state, whatever the kind', async () => {
        const table = openTable()
        const session = await table.openSeat(table.setupSeat)
        session.pressStartingGood('iron')
        expect(session.startingGoods.goods).toEqual(['iron'])

        session.beforeNewState()

        expect(session.startingGoods.goods).toEqual([])
    })

    it.each([
        ['other-action', true],
        ['reconciliation', true],
        ['own-action', true],
        ['undo', false],
        ['history', false],
        ['initial', false],
        ['exploration', false],
        ['view-switch', false],
        ['edit', false]
    ] as const)('%s keeps the local selections: %s', async (kind, kept) => {
        const session = await openTable().openSeat('p1')
        expect(session.keepsLocalSelections({ kind, actions: [], intent: 'actions' })).toBe(kept)
    })
})

describe('components call session methods only', () => {
    it('no component builds or sends an Action', () => {
        const components = import.meta.glob('../components/**/*.svelte', {
            query: '?raw',
            import: 'default',
            eager: true
        })
        const sources = Object.entries(components)
        expect(sources.length).toBeGreaterThan(0)
        for (const [file, source] of sources) {
            expect(String(source), file).not.toMatch(
                /\b(applyAction|createPlayerAction|createAction)\b/
            )
        }
    })
})

describe('the real session: seat paint (S71, R-1.4-H1)', () => {
    it("paints a seat and a colour no seat plays from the session's own colourizer", async () => {
        const table = openTable(3)
        const seat = table.state.players[0].playerId
        const session = await table.openSeat(seat)
        const { paintOf, colourPaintOf } = session

        expect(paintOf(seat)).toEqual(seatPaint(session.colors, seat, session.getPlayerName(seat)))
        expect(paintOf(seat).owner).toBe(`${session.getPlayerName(seat)}'s`)
        const dummy = knightRows(session.gameState).flatMap(({ rowId, row }) =>
            'dummy' in row.owner ? [dummyRowColour(session.gameState, rowId)] : []
        )[0]
        assertExists(dummy, 'R-1.4-H1 Three seats play beside a dummy row')
        expect(colourPaintOf(dummy)).toEqual(colourPaint(session.colors, dummy))
        const seatFills = session.gameState.players.map(({ playerId }) => paintOf(playerId).fill)
        expect(seatFills).not.toContain(colourPaintOf(dummy).fill)
    })
})
