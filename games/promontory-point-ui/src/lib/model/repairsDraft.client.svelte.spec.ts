import { afterEach, describe, expect, it, vi } from 'vitest'
import { GameSession } from '@tabletop/frontend-components'
import {
    ActionType,
    MachineState,
    perRailroad,
    type PromontoryPointGameState,
    type RailroadId,
    type SpaceId
} from '@tabletop/promontory-point'
import {
    dealtTable,
    disposeSessions,
    editedTable,
    openSessionOn,
    settled,
    type Table
} from '$lib/testing/sessionHarness.js'
import {
    canonical,
    seatOf,
    withHoldings,
    withTownsOpenTo,
    withTurnPieces,
    type Holding
} from '@tabletop/promontory-point/testing'
import { everySaleStartingWith, repairsDraftView } from './repairsDraft.js'
import type { PromontoryPointGameSession } from './session.svelte.js'

const CP: RailroadId = 'railroad.cp'
const UP: RailroadId = 'railroad.up'
const KP: RailroadId = 'railroad.kp'
const SP: RailroadId = 'railroad.sp'

afterEach(() => {
    disposeSessions()
    vi.restoreAllMocks()
})

type RepairsTable = { table: Table; town: SpaceId }

// The turn player holds SP, UP, KP with a Repairs town open to SP; prices by price index.
function repairsTable(
    holdings: Holding[],
    priceIndex: Partial<Record<RailroadId, number>> = {}
): RepairsTable {
    const dealt = dealtTable()
    const { state, spaceIds } = withTownsOpenTo(withTurnPieces(dealt.state, [SP, UP, KP]), SP, [
        'tile.red.hammer'
    ])
    const priced: PromontoryPointGameState = structuredClone(withHoldings(state, holdings))
    for (const railroadId of [CP, UP, KP, SP]) {
        priced.priceIndex[railroadId] = priceIndex[railroadId] ?? priced.priceIndex[railroadId]
    }
    return { table: editedTable(dealt, () => canonical(priced)), town: spaceIds[0] }
}

// Royce's case: owes $10 (5 SP × $2) with $7; SP at $6 sells for $3, CP at $5 for $2.
function shortByThree(): RepairsTable {
    return repairsTable(
        [{ money: 20 }, { money: 7, shares: { [SP]: 5, [CP]: 2 } }, { money: 20 }],
        { [SP]: 10 }
    )
}

// Owes $8 (4 SP × $2) with $1; every SP sells for $1, so selling all still leaves $3 owed.
function shortAfterEverything(): RepairsTable {
    return repairsTable([{ money: 20 }, { money: 1, shares: { [SP]: 4 } }, { money: 20 }], {
        [SP]: 6
    })
}

async function placedOnRepairs({ table, town }: RepairsTable) {
    const session = await openSessionOn(table)
    const placer = session.decidingPlayerId
    session.pressPiece(SP)
    await session.placeTrack(town)
    await settled(session)
    expect(session.gameState.machineState).toBe(MachineState.PayingRepairs)
    return { session, placer, debtor: seatOf(table.state, 1) }
}

function staged(session: PromontoryPointGameSession): RailroadId[] {
    return session.repairsDraft?.send.sales ?? []
}

function locked(session: PromontoryPointGameSession): RailroadId[] {
    return (session.repairsDraft?.entries ?? [])
        .filter((entry) => entry.locked)
        .map((entry) => entry.railroadId)
}

// docs/user-interactions.md: the five minimum tests for the Repairs draft (a tap list of sales).
describe('Repairs draft — minimum staged-selection tests', () => {
    it('R-4.3-H2: staging after an Undo replaces the popped sale and clears what followed it', async () => {
        const { session } = await placedOnRepairs(shortByThree())
        session.stageRepairsSale(CP)
        session.stageRepairsSale(SP)
        expect(staged(session)).toEqual([CP, SP])

        await session.undo()
        session.stageRepairsSale(CP)
        expect(staged(session)).toEqual([CP, CP])
        expect(session.repairsDraft?.send.label).toBe('Sell 2 CP shares · pay $10')
    })

    it('R-4.3: Undo with a staged sale pops the last one and undoes no action', async () => {
        const { session } = await placedOnRepairs(shortByThree())
        const actionUndo = vi.spyOn(GameSession.prototype, 'undo')
        session.stageRepairsSale(CP)
        session.stageRepairsSale(SP)
        expect(session.canUndo).toBe(true)

        await session.undo()
        expect(staged(session)).toEqual([CP])
        await session.undo()
        expect(staged(session)).toEqual([])
        expect(session.hasManualSelection).toBe(false)
        expect(actionUndo).not.toHaveBeenCalled()
        expect(session.actions).toHaveLength(1)
    })

    it('R-4.3-H3: the one press staging every share pops as one, then Undo reaches the placement', async () => {
        const { session } = await placedOnRepairs(shortAfterEverything())
        session.stageRepairsSale(SP)
        expect(staged(session)).toEqual([SP, SP, SP, SP])

        await session.undo()
        expect(staged(session)).toEqual([])
        expect(session.actions).toHaveLength(1)
        await session.undo()
        await settled(session)
        expect(session.actions).toHaveLength(0)
        expect(session.gameState.pendingRepairs).toBeUndefined()
    })

    it('R-4.3, R-4.3-H2: fails fast on a share not held, a locked Sell or a send before the bill is covered', async () => {
        const { session } = await placedOnRepairs(shortByThree())
        expect(() => session.stageRepairsSale(KP)).toThrow()
        session.stageRepairsSale(CP)
        await expect(session.sendRepairs()).rejects.toThrow()
        session.stageRepairsSale(SP)
        expect(() => session.stageRepairsSale(CP)).toThrow()
        expect(staged(session)).toEqual([CP, SP])
        expect(session.actions).toHaveLength(1)
    })

    it('R-4.3: each press on a railroad stages one more of it until none is left', async () => {
        const { session } = await placedOnRepairs(
            repairsTable(
                [{ money: 20 }, { money: 1, shares: { [SP]: 5, [CP]: 2 } }, { money: 20 }],
                { [SP]: 10 }
            )
        )
        session.stageRepairsSale(CP)
        session.stageRepairsSale(CP)
        expect(staged(session)).toEqual([CP, CP])
        expect(locked(session)).toEqual([CP])
        expect(() => session.stageRepairsSale(CP)).toThrow()
        session.stageRepairsSale(SP)
        session.stageRepairsSale(SP)
        expect(session.repairsDraft?.send).toMatchObject({ ready: true, paid: 10 })
    })
})

describe('Repairs draft — running line and send (R-4.3, R-4.3-H1 to H3, R-X.1)', () => {
    it('R-4.3-H2, R-4.3-H1: once a sale covers the bill every Sell locks and the bill stays fixed', async () => {
        const { session, placer, debtor } = await placedOnRepairs(shortByThree())
        expect(session.decidingPlayerId).toBe(debtor)
        expect(session.repairsDraft).toMatchObject({
            owed: 10,
            money: 7,
            holdsBilledRailroad: true,
            shortAfterEverySale: false,
            runningLine: 'Have $7 of $10 · short $3'
        })
        expect(session.repairsDraft?.entries).toEqual([
            { railroadId: CP, held: 2, staged: 0, price: 5, proceedsEach: 2, locked: false },
            { railroadId: SP, held: 5, staged: 0, price: 6, proceedsEach: 3, locked: false }
        ])

        session.stageRepairsSale(SP)
        expect(session.repairsDraft?.runningLine).toBe('Have $7 + sale $3 = $10 of $10 · enough')
        expect(session.repairsDraft?.owed).toBe(10)
        expect(locked(session)).toEqual([CP, SP])
        expect(session.repairsDraft?.send).toMatchObject({
            ready: true,
            label: 'Sell 1 SP share · pay $10'
        })

        await session.undo()
        expect(locked(session)).toEqual([])
        session.stageRepairsSale(SP)
        await session.sendRepairs()
        await settled(session)
        expect(session.actions.at(-1)).toMatchObject({ type: ActionType.PayRepairs, sales: [SP] })
        expect(session.gameState.getPlayerState(debtor).money).toBe(0)
        expect(session.gameState.machineState).toBe(MachineState.Placing)
        expect(session.decidingPlayerId).toBe(placer)
        expect(session.repairsDraft).toBeUndefined()
    })

    it('R-4.3-H3: short after every sale, one press stages all and the send names the forgiven amount', async () => {
        const { session, debtor } = await placedOnRepairs(shortAfterEverything())
        expect(session.repairsDraft?.shortAfterEverySale).toBe(true)
        session.stageRepairsSale(SP)
        expect(session.repairsDraft?.runningLine).toBe(
            'Have $1 + sales $4 = $5 of $8 · $3 forgiven'
        )
        expect(session.repairsDraft?.send).toMatchObject({
            ready: true,
            paid: 5,
            forgiven: 3,
            label: 'Sell all 4 · pay $5 · $3 forgiven'
        })

        await session.sendRepairs()
        await settled(session)
        const player = session.gameState.getPlayerState(debtor)
        expect(player.money).toBe(0)
        expect(player.shares[SP]).toBe(0)
    })

    it('R-4.3-H3, R-X.1: with no shares the send pays all and names the forgiven amount', () => {
        const view = repairsDraftView(
            {
                railroadId: SP,
                owed: 8,
                holdings: { money: 3, shares: perRailroad(() => 0) },
                priceIndex: perRailroad(() => 9)
            },
            []
        )
        expect(view.entries).toEqual([])
        expect(view.runningLine).toBe('Have $3 of $8 · $5 forgiven')
        expect(view.send).toEqual({
            sales: [],
            paid: 3,
            forgiven: 5,
            ready: true,
            label: 'Pay $3 · $5 forgiven'
        })
    })

    it('R-4.3-H3: every sale starts with the pressed railroad', () => {
        const shares = { ...perRailroad(() => 0), [CP]: 1, [SP]: 2 }
        expect(everySaleStartingWith(shares, SP)).toEqual([SP, SP, CP])
    })
})

describe('Repairs draft — lifetime, privacy and the placer’s Undo (R-4.3-H4, R-X.2)', () => {
    it('R-4.3: staged sales stay in the deciding seat’s session: nothing is sent and no other seat sees them', async () => {
        const { session, debtor } = await placedOnRepairs(shortByThree())
        const before = structuredClone(session.gameState.getPlayerState(debtor).shares)
        session.stageRepairsSale(SP)
        expect(session.actions).toHaveLength(1)
        expect(session.gameState.getPlayerState(debtor).shares).toEqual(before)

        session.setViewingAsNonActivePlayer(true)
        expect(session.myPlayer?.id).not.toBe(debtor)
        expect(session.repairsDraft).toBeUndefined()
        expect(session.hasManualSelection).toBe(false)
        session.setViewingAsNonActivePlayer(false)
        expect(staged(session)).toEqual([SP])
    })

    it('R-X.2: the placing seat’s Undo while the debtor stages undoes the placement and drops the draft', async () => {
        const repairs = shortByThree()
        const { session, placer } = await placedOnRepairs(repairs)
        session.stageRepairsSale(SP)

        session.setViewingAsNonActivePlayer(true)
        expect(session.myPlayer?.id).toBe(placer)
        expect(session.canUndo).toBe(true)
        await session.undo()
        await settled(session)
        expect(session.actions).toHaveLength(0)
        expect(session.gameState.pendingRepairs).toBeUndefined()

        session.setViewingAsNonActivePlayer(false)
        session.pressPiece(SP)
        await session.placeTrack(repairs.town)
        await settled(session)
        expect(session.repairsDraft).toBeDefined()
        expect(staged(session)).toEqual([])
    })

    it('R-4.3-H4: the next debtor starts with an empty draft, and an undone payment returns to none staged', async () => {
        const { session, debtor } = await placedOnRepairs(
            repairsTable([
                { money: 20 },
                { money: 1, shares: { [SP]: 1 } },
                { money: 0, shares: { [SP]: 1 } }
            ])
        )
        session.stageRepairsSale(SP)
        await session.sendRepairs()
        await settled(session)
        expect(session.decidingPlayerId).not.toBe(debtor)
        expect(session.repairsDraft).toMatchObject({ owed: 2, money: 0 })
        expect(staged(session)).toEqual([])

        await session.undo()
        await settled(session)
        expect(session.decidingPlayerId).toBe(debtor)
        expect(staged(session)).toEqual([])
    })

    it('R-4.3: staged sales stay when the history behind the Repairs loads', async () => {
        const { session } = await placedOnRepairs(shortByThree())
        const reopened = await openSessionOn({
            game: session.game,
            state: canonical(session.gameState.dehydrate()),
            actions: [],
            historyComplete: false
        })
        reopened.stageRepairsSale(SP)
        // The host's answer to the history request: the complete context the first session holds.
        type WithHistory = {
            gameContext: unknown
            loadRecoveryContext: () => Promise<unknown>
        }
        const complete = (session as unknown as WithHistory).gameContext
        vi.spyOn(reopened as unknown as WithHistory, 'loadRecoveryContext').mockResolvedValue(
            complete
        )
        await reopened.loadHistory()
        expect(reopened.actions.length).toBe(session.actions.length)
        expect(staged(reopened)).toEqual([SP])
    })

    it('R-4.3: a send while an earlier action is still with the host keeps the staged sales', async () => {
        const { session } = await placedOnRepairs(shortByThree())
        session.stageRepairsSale(SP)
        const actionCount = session.actions.length
        session.processingActions = true
        await session.sendRepairs()
        expect(session.actions.length).toBe(actionCount)
        expect(staged(session)).toEqual([SP])
    })

    it('R-4.3, R-X.1: the debtor gets its panel from the state alone, before the history behind it loads', async () => {
        const { session, placer, debtor } = await placedOnRepairs(shortByThree())
        // docs/request-performance.md: a game opens on its state, with its Actions loaded later.
        const reopened = await openSessionOn({
            game: session.game,
            state: canonical(session.gameState.dehydrate()),
            actions: [],
            historyComplete: false
        })
        expect(reopened.decidingPlayerId).toBe(debtor)
        expect(reopened.repairsPanel?.prompt.parts[0]).toEqual({ kind: 'player', playerId: placer })
        reopened.stageRepairsSale(SP)
        expect(reopened.repairsPanel?.send).toMatchObject({
            label: 'Sell 1 SP share · pay $10',
            ready: true
        })
    })
})
