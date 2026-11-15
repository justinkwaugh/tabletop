import { afterEach, describe, expect, it, vi } from 'vitest'
import { GameSession } from '@tabletop/frontend-components'
import {
    MachineState,
    OPENING_AUCTION_ORDER,
    RAILROAD_IDS,
    isBuildTrack,
    isDeterminePlayerOrder
} from '@tabletop/preussische-ostbahn'
import {
    disposeSessions,
    firstTurnTable,
    openingDrawTable,
    openSessionOn,
    withSharesForTurnPlayer
} from '$lib/testing/sessionHarness.js'
import { historyEntries } from '$lib/utils/history.js'
import { TurnIntent, TurnStageOrder } from './selection.js'
import { setStagedSelectionValue } from '@tabletop/frontend-components'

afterEach(() => {
    disposeSessions()
    vi.restoreAllMocks()
})

function spyOnActionUndo() {
    return vi.spyOn(GameSession.prototype, 'undoCommittedAction').mockResolvedValue()
}

function sessionWithRailroad() {
    const session = openSessionOn(withSharesForTurnPlayer(firstTurnTable()))
    const [railroadId] = session.expandableRailroads
    session.chooseIntent(TurnIntent.Build)
    session.chooseExpansionRailroad(railroadId)
    return { session, railroadId }
}

describe('drawing the turn order', () => {
    it('sends the round ender’s draw as an Action that reveals it', async () => {
        const session = openSessionOn(openingDrawTable())
        expect(session.canDrawTurnOrder).toBe(true)
        const apply = vi.spyOn(GameSession.prototype, 'applyAction').mockResolvedValue()
        await session.drawTurnOrder()
        expect(apply).toHaveBeenCalledOnce()
        const [action] = apply.mock.calls[0]
        expect(isDeterminePlayerOrder(action) && action.revealsInfo).toBe(true)
    })
})

describe('choosing an action', () => {
    it('offers Expansion for held railroads and every first-sold railroad for Capitalization', () => {
        const session = openSessionOn(withSharesForTurnPlayer(firstTurnTable()))
        expect(session.gameState.machineState).toBe(MachineState.ChoosingAction)
        expect(session.expandableRailroads.length).toBeGreaterThan(0)
        expect(session.capitalizableRailroads).toEqual(RAILROAD_IDS)
    })
})

describe('building track', () => {
    it('prices each space the chosen railroad can reach', () => {
        const { session, railroadId } = sessionWithRailroad()
        expect(session.expansionRailroad).toBe(railroadId)
        expect(session.expansionTargets.length).toBeGreaterThan(0)
        for (const target of session.expansionTargets) {
            expect(target.cost).toBe(session.gameState.trackCharge(railroadId, target.spaceId))
        }
    })

    it('sends one BuildTrack per space pressed, with no confirmation', async () => {
        const { session, railroadId } = sessionWithRailroad()
        const [target] = session.expansionTargets
        const apply = vi.spyOn(GameSession.prototype, 'applyAction').mockResolvedValue()
        await session.chooseSpace(target.spaceId)
        expect(apply).toHaveBeenCalledOnce()
        const [action] = apply.mock.calls[0]
        expect(isBuildTrack(action) && action.railroadId === railroadId && action.spaceId).toBe(
            target.spaceId
        )
    })

    it('takes back the railroad, then the choice to build, before any Action', async () => {
        const actionUndo = spyOnActionUndo()
        const { session } = sessionWithRailroad()
        expect(session.expandableRailroads.length).toBeGreaterThan(1)
        await session.undo()
        expect(session.expansionRailroad).toBeUndefined()
        expect(session.intent).toBe(TurnIntent.Build)
        await session.undo()
        expect(session.intent).toBeUndefined()
        expect(actionUndo).not.toHaveBeenCalled()
        await session.undo()
        expect(actionUndo).toHaveBeenCalledOnce()
    })

    it('shows no rings until Build track is chosen', () => {
        const session = openSessionOn(withSharesForTurnPlayer(firstTurnTable()))
        session.chooseExpansionRailroad(session.expandableRailroads[0])
        expect(session.expansionRailroad).toBeUndefined()
        expect(session.expansionTargets).toEqual([])
    })
})

describe('the selection helpers', () => {
    it('rejects a stage outside the order', () => {
        expect(() =>
            setStagedSelectionValue({}, TurnStageOrder, 'unknown' as never, 1, 'manual')
        ).toThrow()
    })
})

describe('history', () => {
    it('groups each opening auction under its railroad and starts a round entry', () => {
        const entries = historyEntries(firstTurnTable().actions)
        const auctions = entries.filter((entry) => entry.kind === 'auction')
        expect(auctions.map((entry) => entry.kind === 'auction' && entry.railroadId)).toEqual(
            OPENING_AUCTION_ORDER
        )
        expect(entries.at(-1)?.kind).toBe('round')
    })
})
