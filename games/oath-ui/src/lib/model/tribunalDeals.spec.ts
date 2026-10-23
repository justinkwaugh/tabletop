import { describe, expect, it } from 'vitest'
import { ActionSource, Color, type GameAction } from '@tabletop/common'
import { ActionType, PlayerStatus, type OpenDeal } from '@tabletop/oath'
import { openTurn, testPlayer, testState } from '@tabletop/oath/testing'
import { dealCount, droppedDeals, promiseBy, quotedPromise, tribunalDealRows } from './tribunalDeals.js'

const DEAL: OpenDeal = {
    id: 'd1',
    proposerPlayerId: 'p1',
    counterpartyPlayerId: 'p2',
    proposerPromise: 'I stay home.',
    round: 2
}

function action(fields: { type: ActionType; playerId: string } & Record<string, unknown>): GameAction {
    return { id: 'a1', gameId: 'g1', source: ActionSource.User, ...fields }
}

describe('the Tribunal’s deals on the table (R-7.6.3-H1)', () => {
    it('reads each party’s own promise, and none for a party who promised nothing or a third seat', () => {
        expect(promiseBy(DEAL, 'p1')).toBe('I stay home.')
        expect(promiseBy(DEAL, 'p2')).toBeUndefined()
        expect(promiseBy({ ...DEAL, counterpartyPromise: 'I go.' }, 'p2')).toBe('I go.')
        expect(promiseBy(DEAL, 'p3')).toBeUndefined()
    })

    it('quotes a promise for the end-of-game row, or says none was made', () => {
        expect(quotedPromise('I stay home.')).toBe('"I stay home."')
        expect(quotedPromise(undefined)).toBe('nothing promised')
    })

    it('counts the deals on the name pill’s mark: "1 deal", "2 deals"', () => {
        expect(dealCount(1)).toBe('1 deal')
        expect(dealCount(2)).toBe('2 deals')
    })

    it('lists Resolve Tribunal’s rows, one per deal the seat is party to; "Ask" only where the claim is open', () => {
        const state = testState(
            [
                testPlayer({ playerId: 'p1', color: Color.Red, siteId: 'c1' }),
                testPlayer({ playerId: 'p2', color: Color.Blue, siteId: 'c1' }),
                testPlayer({ playerId: 'p3', color: Color.Purple, status: PlayerStatus.Chancellor, siteId: 'c1' })
            ],
            {
                round: 3,
                openDeals: [
                    DEAL,
                    { ...DEAL, id: 'd2', proposerPlayerId: 'p3', counterpartyPlayerId: 'p1', lastClaimedTurn: { round: 3, playerId: 'p1' } },
                    { ...DEAL, id: 'd3', proposerPlayerId: 'p2', counterpartyPlayerId: 'p3' }
                ]
            }
        )
        openTurn(state, 'p1')
        expect(tribunalDealRows(state, 'p1', true)).toEqual([
            { deal: DEAL, otherPlayerId: 'p2', canAsk: true },
            { deal: state.openDeals?.[1], otherPlayerId: 'p3', canAsk: false }
        ])
        // A claim the engine does not offer now (a free action due) is offered on no row.
        expect(tribunalDealRows(state, 'p1', false).map((row) => row.canAsk)).toEqual([false, false])
        expect(tribunalDealRows(state, 'p2', true).map((row) => row.otherPlayerId)).toEqual(['p1', 'p3'])
    })

    it('reads the deals the ending dropped from the ending action’s record, and none from an ending that dropped none', () => {
        const wake = (metadata: Record<string, unknown>) =>
            action({ type: ActionType.ResolveWake, playerId: 'p1', favorSteps: [], metadata })
        const earlier = wake({ flippedToUsurper: false })
        expect(droppedDeals([earlier, wake({ wonBy: 'R-3.1', openDealsDropped: [DEAL] })])).toEqual([DEAL])
        expect(droppedDeals([earlier, wake({ wonBy: 'R-3.1' })])).toEqual([])
        expect(droppedDeals([earlier])).toEqual([])
        const roll = action({
            type: ActionType.RollEndDie,
            playerId: 'p1',
            metadata: { wonBy: 'R-3.3', openDealsDropped: [DEAL] }
        })
        expect(droppedDeals([roll])).toEqual([DEAL])
    })
})
