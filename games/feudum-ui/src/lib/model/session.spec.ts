import { flushSync } from 'svelte'
import { assertExists } from '@tabletop/common'
import { GameSession } from '@tabletop/frontend-components'
import { ActionType, MachineState, StartingSpaceIds, type Good } from '@tabletop/feudum'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FeudumHost } from '$lib/testing/sessionHarness.js'
import { primaryLabel, sendsOnPress } from './confirmingSend.js'
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
        const filled = { sulfurTo: { value: 'barrel', source: 'manual' } } as const
        expect(
            withLoneChoice<StartingGoodsValues, 'sulfurTo'>(
                filled,
                StartingGoodsStageOrder,
                'sulfurTo',
                ['supply']
            )
        ).toBe(filled)
        for (const choices of [[], ['supply', 'barrel']] as const) {
            expect(
                withLoneChoice<StartingGoodsValues, 'sulfurTo'>(
                    {},
                    StartingGoodsStageOrder,
                    'sulfurTo',
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
    it('setting a stage clears the stages after it', () => {
        const draft = goodsDraft()
        for (const good of ['sulfur', 'iron', 'food'] as const) draft.press(good)
        draft.chooseSulfurDestination('barrel')

        draft.set('goods', ['sulfur', 'iron', 'wood'])

        expect(draft.sulfurTo).toBeUndefined()
    })

    it('Undo with a manual stage pops the highest and takes no Action back', () => {
        const draft = goodsDraft()
        for (const good of ['sulfur', 'iron', 'food'] as const) draft.press(good)
        draft.chooseSulfurDestination('barrel')

        expect(draft.localSelection.undo()).toBe(true)

        expect(draft.sulfurTo).toBeUndefined()
        expect(draft.goods).toEqual(['sulfur', 'iron', 'food'])
    })

    it('Undo with only an auto stage falls through to the Action undo', () => {
        const draft = goodsDraft(['iron', 'wood', 'food'])
        expect(draft.entry('goods')?.source).toBe('auto')
        expect(draft.localSelection.hasManual()).toBe(false)
        expect(draft.localSelection.undo()).toBe(false)
        expect(draft.goods).toEqual(['iron', 'wood', 'food'])
    })

    it('a stage the order lacks throws', () => {
        expect(() =>
            new StagedDraft<StartingGoodsValues>(['goods']).set('sulfurTo', 'barrel')
        ).toThrow('does not exist in stage order')
    })

    it('reselecting an earlier stage: a press changes the list and asks for sulfur again', () => {
        const draft = goodsDraft()
        for (const good of ['sulfur', 'iron', 'food'] as const) draft.press(good)
        draft.chooseSulfurDestination('barrel')
        expect(draft.ready).toBe(true)

        draft.press('food')
        draft.press('wood')

        expect(draft.goods).toEqual(['sulfur', 'iron', 'wood'])
        expect(draft.asksSulfurDestination).toBe(true)
        expect(draft.ready).toBe(false)
    })
})

describe('StartingGoodsDraft (R-1.4.8): stacked stage', () => {
    it('Undo pops the latest press and keeps the earlier ones', () => {
        const draft = goodsDraft()
        for (const good of ['saltpeter', 'sulfur', 'food'] as const) draft.press(good)

        draft.localSelection.undo()

        expect(draft.goods).toEqual(['saltpeter', 'sulfur'])
    })

    it('a press clears every later stage, and Undo pops the open later stage first', () => {
        const draft = goodsDraft()
        for (const good of ['sulfur', 'iron', 'food'] as const) draft.press(good)
        draft.chooseSulfurDestination('supply')

        draft.localSelection.undo()
        expect(draft.goods).toEqual(['sulfur', 'iron', 'food'])
        expect(draft.sulfurTo).toBeUndefined()

        draft.localSelection.undo()
        expect(draft.goods).toEqual(['sulfur', 'iron'])
    })

    it('a fourth good and an unpick of a good nobody picked change nothing', () => {
        const draft = goodsDraft()
        for (const good of ['saltpeter', 'iron', 'food'] as const) draft.press(good)
        draft.press('wood')
        expect(draft.goods).toEqual(['saltpeter', 'iron', 'food'])
    })

    it('the destination is asked only of sulfur', () => {
        const draft = goodsDraft()
        draft.press('iron')
        draft.chooseSulfurDestination('barrel')
        expect(draft.sulfurTo).toBeUndefined()
        expect(draft.asksSulfurDestination).toBe(false)
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
        expect(session.startingGoodsPanel?.asksSulfurDestination).toBe(true)
        expect(session.startingGoodsPanel?.primary?.enabled).toBe(false)

        session.chooseSulfurDestination('barrel')
        flushSync()
        expect(session.startingGoodsPanel?.primary).toEqual({
            label: 'Take saltpeter, sulfur (barrel), food',
            enabled: true
        })

        await session.undo()
        expect(session.startingGoods.sulfurTo).toBeUndefined()
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
        await session.sendStartingGoods()
        session.pressStartingGood('iron')
        session.pressStartingGood('food')
        await session.sendStartingGoods()

        expect(table.actions).toEqual([])
    })

    it('another seat sees counts and the waiting line, and has no draft', async () => {
        const table = openTable()
        const waiting = table.order.find((id) => id !== table.setupSeat) ?? ''
        const session = await table.openSeat(waiting)

        session.pressStartingGood('iron')
        flushSync()

        const panel = session.startingGoodsPanel
        expect(panel?.deciding).toBe(false)
        expect(panel?.waitingLine).toBe(
            `${session.getPlayerName(table.setupSeat)} chooses starting goods`
        )
        expect(session.startingGoods.goods).toEqual([])
        expect(panel?.goods.every(({ picked }) => !picked)).toBe(true)
    })

    it('a good the haversack has run out of is dimmed with its line, and a press does nothing', async () => {
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
    })

    it('with three picked, a fourth is dimmed by the same rule', async () => {
        const table = openTable()
        const session = await table.openSeat(table.setupSeat)
        for (const good of ['saltpeter', 'iron', 'food'] as const) session.pressStartingGood(good)
        flushSync()

        const goods = session.startingGoodsPanel?.goods
        expect(goods?.find(({ good }) => good === 'wood')?.refusal).toBe('Choose 3 goods.')
        expect(goods?.find(({ good }) => good === 'iron')?.refusal).toBeUndefined()
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
        expect(session.startingGoods.entry('goods')?.source).toBe('auto')
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
        expect(session.startingPawnPanel?.characters.find((c) => c.picked)?.rankChip).toBe('master')

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
            const chip = session.startingPawnPanel?.characters.find(
                ({ character }) => character === 'knight'
            )?.rankChip
            expect(chip).toBe(['master', 'journeyman', 'apprentice', 'no rank'][placed])
            await table.send(seat, {
                type: ActionType.PlaceStartingPawn,
                character: 'knight',
                spaceId: DESERT_3
            })
        }
        const session = await table.openSeat(table.setupSeat)
        expect(
            session.startingPawnPanel?.characters.find(({ character }) => character === 'knight')
                ?.rankChip
        ).toBe('no rank')
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
