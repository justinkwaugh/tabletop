import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushSync } from 'svelte'
import { GameSession, type TransitionKind } from '@tabletop/frontend-components'
import {
    ActionType,
    HydratedDickeKartoffelnGameState,
    MachineState,
    PlanKind,
    Variety
} from '@tabletop/dicke-kartoffeln'
import { YearEndStatus } from '$lib/utils/yearEnd.js'
import {
    disposeSessions,
    openSessionOn,
    playUntil,
    startingTable,
    submit,
    type PlayedTable
} from '$lib/testing/sessionHarness.js'
import { draftPlan } from './draft.js'
import { TableView } from './session.svelte.js'

afterEach(() => {
    disposeSessions()
    vi.restoreAllMocks()
})

function spyOnActionUndo() {
    return vi.spyOn(GameSession.prototype, 'undoCommittedAction').mockResolvedValue()
}

function atSowing(): PlayedTable {
    let table = startingTable()
    for (const playerId of ['p1', 'p2', 'p3']) {
        table = submit(table, playerId, { kind: PlanKind.TakeCompost, takes: [] })
    }
    for (const playerId of ['p1', 'p2', 'p3']) {
        table = submit(table, playerId, { kind: PlanKind.Cultivate, fieldIds: [1, 2] })
    }
    expect(table.state.machineState).toBe(MachineState.Sowing)
    return table
}

describe('the plan draft', () => {
    it('toggles fields and counts worms clicked off a field', () => {
        expect(
            draftPlan(PlanKind.Cultivate, [
                { kind: 'plough', fieldId: 2 },
                { kind: 'plough', fieldId: 4 },
                { kind: 'plough', fieldId: 2 }
            ])
        ).toEqual({ kind: PlanKind.Cultivate, fieldIds: [4] })
        expect(
            draftPlan(PlanKind.TakeCompost, [
                { kind: 'take', fieldId: 3 },
                { kind: 'take', fieldId: 3 },
                { kind: 'take', fieldId: 1 }
            ])
        ).toEqual({
            kind: PlanKind.TakeCompost,
            takes: [
                { fieldId: 1, worms: 1 },
                { fieldId: 3, worms: 2 }
            ]
        })
    })

    it('keeps the latest seed and offer for each field', () => {
        expect(
            draftPlan(PlanKind.Sow, [
                { kind: 'seed', fieldId: 1, variety: Variety.Amalie },
                { kind: 'seed', fieldId: 1, variety: Variety.Biola },
                { kind: 'seed', fieldId: 2, variety: Variety.Chris },
                { kind: 'seed', fieldId: 2 }
            ])
        ).toEqual({ kind: PlanKind.Sow, seeds: [{ fieldId: 1, variety: Variety.Biola }] })
        expect(
            draftPlan(PlanKind.RegisterSales, [
                { kind: 'offer', fieldId: 1, norm: 2, bio: 0 },
                { kind: 'offer', fieldId: 1, norm: 3, bio: 0 }
            ])
        ).toEqual({ kind: PlanKind.RegisterSales, sales: [{ fieldId: 1, norm: 3, bio: 0 }] })
    })
})

describe('planning a round', () => {
    it('prices the draft and opens the yield sheet when sowing', () => {
        const session = openSessionOn(atSowing())
        expect(session.planning).toBe(true)
        expect(session.view).toBe(TableView.Sheet)
        expect(session.fieldTargets).toEqual([1, 2])
        session.chooseSeed(1, Variety.Chris)
        session.chooseSeed(3, Variety.Amalie)
        flushSync()
        expect(session.preview?.plan).toEqual({
            kind: PlanKind.Sow,
            seeds: [{ fieldId: 1, variety: Variety.Chris }]
        })
        expect(session.preview?.cost).toBe(session.gameState.seedPrice(Variety.Chris))
    })

    it('closes the seed picker when the farmer looks away from their own farm', async () => {
        const session = openSessionOn(atSowing())
        session.showMyFarm()
        await session.clickField(1)
        flushSync()
        expect(session.seedPickerField).toBe(1)
        session.showFarm('p2')
        flushSync()
        expect(session.seedPickerField).toBeUndefined()
        expect(session.hasLocalSelection).toBe(false)
        session.showMyFarm()
        flushSync()
        expect(session.seedPickerField).toBeUndefined()

        await session.clickField(1)
        session.showSheet('p1')
        flushSync()
        expect(session.seedPickerField).toBeUndefined()
        expect(session.hasLocalSelection).toBe(false)
    })

    it('takes back the latest edit before undoing any action', async () => {
        const actionUndo = spyOnActionUndo()
        const session = openSessionOn(startingTable())
        await session.clickField(1)
        await session.clickField(2)
        flushSync()
        expect(session.hasLocalSelection).toBe(true)
        await session.undo()
        flushSync()
        expect(session.preview?.plan).toEqual({
            kind: PlanKind.TakeCompost,
            takes: [{ fieldId: 1, worms: 1 }]
        })
        await session.undo()
        flushSync()
        expect(session.hasLocalSelection).toBe(false)
        expect(actionUndo).not.toHaveBeenCalled()
        await session.undo()
        expect(actionUndo).toHaveBeenCalledOnce()
    })

    it('closes an open seed picker before taking back any edit', async () => {
        const actionUndo = spyOnActionUndo()
        const session = openSessionOn(atSowing())
        session.showMyFarm()
        await session.clickField(1)
        flushSync()
        expect(session.hasLocalSelection).toBe(true)
        await session.undo()
        flushSync()
        expect(session.seedPickerField).toBeUndefined()
        expect(session.hasLocalSelection).toBe(false)
        expect(actionUndo).not.toHaveBeenCalled()

        await session.clickField(1)
        session.chooseSeed(1, Variety.Chris)
        await session.clickField(2)
        flushSync()
        expect(session.seedPickerField).toBe(2)
        await session.undo()
        flushSync()
        expect(session.seedPickerField).toBeUndefined()
        expect(session.preview?.plan).toEqual({
            kind: PlanKind.Sow,
            seeds: [{ fieldId: 1, variety: Variety.Chris }]
        })
        await session.undo()
        flushSync()
        expect(session.preview?.plan).toEqual({ kind: PlanKind.Sow, seeds: [] })
        expect(actionUndo).not.toHaveBeenCalled()
    })

    it('flags a plan that needs a loan', async () => {
        const table = startingTable()
        const players = table.state.players.map((player) =>
            player.playerId === 'p1' ? { ...player, cash: 50 } : player
        )
        const session = openSessionOn({ ...table, state: { ...table.state, players } })
        await session.clickField(1)
        flushSync()
        expect(session.preview).toMatchObject({ cost: 100, loans: 1, problem: undefined })
    })

    it('keeps the draft when another farmer seals, and clears it on its own action', () => {
        const session = openSessionOn(startingTable())
        const keeps = (kind: TransitionKind) =>
            session.keepsLocalSelections({ kind, actions: [], intent: 'actions' })
        expect(keeps('other-action')).toBe(true)
        expect(keeps('reconciliation')).toBe(true)
        expect(keeps('own-action')).toBe(false)
        expect(keeps('undo')).toBe(false)
        expect(keeps('history')).toBe(false)
    })

    it('keeps what the farmer looks at through the round, and opens a new round on their own', () => {
        const table = atSowing()
        const session = openSessionOn(table)
        session.showFarm('p3')
        flushSync()
        const sealed = submit(table, 'p2', { kind: PlanKind.Sow, seeds: [] })
        session.gameState = new HydratedDickeKartoffelnGameState(sealed.state)
        flushSync()
        expect([session.view, session.farmPlayerId]).toEqual([TableView.Farm, 'p3'])

        session.showSheet('p2')
        flushSync()
        let next = sealed
        for (const playerId of ['p1', 'p3']) {
            next = submit(next, playerId, { kind: PlanKind.Sow, seeds: [] })
        }
        expect(next.state.machineState).not.toBe(MachineState.Sowing)
        session.gameState = new HydratedDickeKartoffelnGameState(next.state)
        flushSync()
        expect([session.farmPlayerId, session.sheetPlayerId]).toEqual(['p1', 'p1'])
    })

    it('keeps the farm, the open seed picker and the sown bags when another farmer seals', async () => {
        const table = atSowing()
        const session = openSessionOn(table)
        session.showMyFarm()
        await session.clickField(1)
        session.chooseSeed(1, Variety.Chris)
        await session.clickField(2)
        flushSync()
        expect(session.seedPickerField).toBe(2)
        const sealed = submit(table, 'p2', { kind: PlanKind.Sow, seeds: [] })
        expect(sealed.state.machineState).toBe(MachineState.Sowing)
        session.gameState = new HydratedDickeKartoffelnGameState(sealed.state)
        flushSync()
        expect(session.view).toBe(TableView.Farm)
        expect(session.seedPickerField).toBe(2)
        expect(session.preview?.plan).toEqual({
            kind: PlanKind.Sow,
            seeds: [{ fieldId: 1, variety: Variety.Chris }]
        })
    })

    it('shows who has sealed a plan from the public record', () => {
        const table = submit(startingTable(), 'p2', { kind: PlanKind.TakeCompost, takes: [] })
        const session = openSessionOn(table)
        expect(session.sealedPlayerIds).toEqual(['p2'])
    })
})

function yearOf(table: PlayedTable): number {
    return table.state.years.series.length
}

// p1 takes a worm to compost in year 1, then sows Amalie on field 1 in year 2.
function intoYearTwo(): PlayedTable {
    return playUntil(
        startingTable(),
        (table) => yearOf(table) === 2,
        (table, playerId) =>
            playerId === 'p1' && table.state.machineState === MachineState.TakingCompost
                ? { kind: PlanKind.TakeCompost, takes: [{ fieldId: 1, worms: 1 }] }
                : undefined
    )
}

describe('the close of the year', () => {
    it('walks the next farmer through rounds 9 to 12 before their first plan', () => {
        const session = openSessionOn(intoYearTwo())
        const report = session.pendingYearEnd
        expect(report?.year).toBe(1)
        expect(report?.phases.map((phase) => phase.status)).toEqual([
            YearEndStatus.Resolved,
            YearEndStatus.Skipped,
            YearEndStatus.Resolved,
            YearEndStatus.Resolved
        ])
        expect(report?.phases[2].results.p1).toEqual(['1 → 2 worms'])
        expect(session.myPlanningTurn).toBe(true)
        expect(session.planning).toBe(false)
        expect(session.fieldTargets).toEqual([])

        session.showYearEndStep(9)
        flushSync()
        expect(session.yearEndStep).toBe(3)
        session.finishYearEnd()
        flushSync()
        expect(session.pendingYearEnd).toBeUndefined()
        expect(session.planning).toBe(true)
    })

    it('stops the history arrows at each round of the close', () => {
        const table = intoYearTwo()
        const session = openSessionOn(table)
        const stops = table.actions
            .filter((action) => !session.shouldAutoStepAction(action))
            .map((action) => action.type)
        expect(stops).toEqual(
            expect.arrayContaining([
                ActionType.ReactSoil,
                ActionType.MoveCompost,
                ActionType.EndYear
            ])
        )
        expect(stops).not.toContain(ActionType.Harvest)
    })
})

describe('offering potatoes', () => {
    it('offers every harvested sack in one edit', async () => {
        const table = playUntil(
            intoYearTwo(),
            (played) =>
                played.state.machineState === MachineState.RegisteringSales &&
                played.state.activePlayerIds[0] === 'p1',
            (played, playerId) => {
                if (playerId !== 'p1') return undefined
                switch (played.state.machineState) {
                    case MachineState.Cultivating:
                        return { kind: PlanKind.Cultivate, fieldIds: [1] }
                    case MachineState.Sowing:
                        return {
                            kind: PlanKind.Sow,
                            seeds: [{ fieldId: 1, variety: Variety.Amalie }]
                        }
                    default:
                        return undefined
                }
            }
        )
        const session = openSessionOn(table)
        const harvest = session.myPlayerState?.field(1).harvest ?? 0
        expect(harvest).toBeGreaterThan(0)
        session.offerAll()
        flushSync()
        expect(session.myPlayerState?.field(1).sunflowers).toBe(3)
        expect(session.preview?.plan).toEqual({
            kind: PlanKind.RegisterSales,
            sales: [{ fieldId: 1, norm: 0, bio: harvest }]
        })
        expect(session.offeringAll).toBe(true)
        await session.undo()
        flushSync()
        expect(session.hasLocalSelection).toBe(false)
    })
})

describe('reading messages', () => {
    it('pages through the face-up cards and wraps around', () => {
        const session = openSessionOn(startingTable())
        const cards = session.readableMessages.map((card) => card.messageId)
        expect(cards).toHaveLength(3)
        session.readMessage(cards[0])
        session.readNeighbourMessage(-1)
        expect(session.readingMessage).toBe(cards[2])
        session.readNeighbourMessage(1)
        session.readNeighbourMessage(1)
        expect(session.readingMessage).toBe(cards[1])
    })
})
