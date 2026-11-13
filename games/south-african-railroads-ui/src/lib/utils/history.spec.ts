import { describe, expect, it } from 'vitest'
import { ActionSource, type GameAction } from '@tabletop/common'
import { ActionBox, ActionType, AuctionKind, RailroadId } from '@tabletop/south-african-railroads'
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

describe('history entries', () => {
    it('groups an opening auction with its free build', () => {
        const entries = historyEntries([
            action(ActionType.PlaceBid, { amount: 3 }),
            action(ActionType.PassBid, {
                metadata: {
                    sale: {
                        railroadId: RailroadId.CdFM,
                        kind: AuctionKind.InitialOffering,
                        buyerId: 'p1',
                        price: 3
                    }
                }
            }),
            action(ActionType.BuildTrack, { railroadId: RailroadId.CdFM, linkIds: ['x'] }),
            action(ActionType.PassBid)
        ])
        expect(entries.map((entry) => entry.kind)).toEqual(['offering', 'offering'])
        expect(entries[0]).toMatchObject({ railroadId: RailroadId.CdFM })
        expect(entries[0].kind === 'offering' && entries[0].actions).toHaveLength(3)
    })

    it('opens a turn per chosen action and keeps dividends apart', () => {
        const entries = historyEntries([
            action(ActionType.ChooseAction, { box: ActionBox.OfferStock }),
            action(ActionType.OfferShare, { railroadId: RailroadId.NRC, ownShare: false }),
            action(ActionType.PlaceBid, { amount: 4, playerId: 'p2' }),
            action(ActionType.PayDividends, { playerId: undefined }),
            action(ActionType.ChooseAction, { box: ActionBox.ConstructTrack, playerId: 'p2' })
        ])
        expect(entries.map((entry) => entry.kind)).toEqual(['turn', 'dividend', 'turn'])
        expect(entries[0].kind === 'turn' && entries[0].actions).toHaveLength(3)
        expect(entries[2]).toMatchObject({ playerId: 'p2', box: ActionBox.ConstructTrack })
    })
})
