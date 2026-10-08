import { describe, expect, it } from 'vitest'
import { ActionSource, type GameAction } from '@tabletop/common'
import { ActionSpace, ActionType, AuctionKind, CompanyId } from '@tabletop/hill-country-grocers'
import { historyEntries } from './history.js'

let next = 0
function action(type: ActionType, fields: Record<string, unknown> = {}): GameAction {
    next += 1
    return {
        id: `a${next}`,
        gameId: 'g',
        source: ActionSource.User,
        playerId: 'p1',
        type,
        ...fields
    }
}

function sold(companyId: CompanyId) {
    return {
        metadata: {
            withdrawnPlayerIds: [],
            sale: { companyId, kind: AuctionKind.Initial, buyerId: 'p1', price: 2 }
        }
    }
}

describe('history entries', () => {
    it('groups each initial auction with its bonus store', () => {
        const entries = historyEntries([
            action(ActionType.PlaceBid, { amount: 2 }),
            action(ActionType.PassBid, sold(CompanyId.Streamside)),
            action(ActionType.BuildNetwork, {
                companyId: CompanyId.Streamside,
                hexes: [{ q: 5, r: -1 }]
            }),
            action(ActionType.PlaceBid, { amount: 0 })
        ])
        expect(entries.map((entry) => entry.kind)).toEqual(['initial', 'initial'])
        expect(entries[0]).toMatchObject({ companyId: CompanyId.Streamside })
        expect(entries[0].kind === 'initial' && entries[0].actions).toHaveLength(3)
    })

    it('opens a turn per chosen action and keeps dividends apart', () => {
        const entries = historyEntries([
            action(ActionType.ChooseAction, { space: ActionSpace.AuctionShare }),
            action(ActionType.OpenAuction, { companyId: CompanyId.Verbena, amount: 1 }),
            action(ActionType.PlaceBid, { amount: 2, playerId: 'p2' }),
            action(ActionType.PayDividends, { playerId: undefined }),
            action(ActionType.ChooseAction, { space: ActionSpace.DevelopTowns, playerId: 'p2' })
        ])
        expect(entries.map((entry) => entry.kind)).toEqual(['turn', 'dividend', 'turn'])
        expect(entries[0].kind === 'turn' && entries[0].actions).toHaveLength(3)
        expect(entries[2]).toMatchObject({ playerId: 'p2', space: ActionSpace.DevelopTowns })
    })
})
