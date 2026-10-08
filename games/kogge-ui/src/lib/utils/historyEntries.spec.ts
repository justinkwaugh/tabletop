import { describe, expect, it } from 'vitest'
import { ActionSource, type GameAction } from '@tabletop/common'
import { ActionType, SailRouteKind, noGoods } from '@tabletop/kogge'
import { historyEntries } from './historyEntries.js'

let index = 0
function action(type: ActionType, fields: Record<string, unknown> = {}): GameAction {
    return {
        id: `a${index}`,
        gameId: 'g',
        source: ActionSource.User,
        type,
        index: index++,
        ...fields
    }
}

describe('historyEntries', () => {
    it('groups the auction and each merchant turn under round markers', () => {
        index = 0
        const actions = [
            action(ActionType.BeginRound, {
                source: ActionSource.System,
                metadata: { round: 1, offer: [[1, 2]], extraMarkers: {} }
            }),
            action(ActionType.PlaceBid, { playerId: 'p1', markers: [3] }),
            action(ActionType.PlaceBid, { playerId: 'p2', markers: [4] }),
            action(ActionType.ResolveAuction, {
                source: ActionSource.System,
                metadata: { deliveries: [], turnOrder: ['p2', 'p1'] }
            }),
            action(ActionType.MoveGuildMaster, {
                playerId: 'p2',
                steps: 1,
                metadata: { stops: [3], goodsPlaced: 2, endsGame: false }
            }),
            action(ActionType.Sail, {
                playerId: 'p2',
                route: { kind: SailRouteKind.Route, slot: 0 },
                payment: { goods: noGoods(), markers: [] },
                metadata: { from: 1, destination: 4, revealed: false, blocked: false, collected: 0 }
            }),
            action(ActionType.EndTurn, { playerId: 'p2' }),
            action(ActionType.EndTurn, { playerId: 'p1' })
        ]
        const entries = historyEntries(actions)
        expect(entries.map((entry) => entry.kind)).toEqual([
            'round',
            'auction',
            'guildMaster',
            'turn',
            'turn'
        ])
        const auction = entries[1]
        expect(auction.kind === 'auction' && auction.lines.length).toBe(4)
        const [, , , first, second] = entries
        expect(first.kind === 'turn' && first.playerId).toBe('p2')
        expect(first.kind === 'turn' && first.complete).toBe(true)
        expect(second.kind === 'turn' && second.lines.length).toBe(0)
    })

    it('keeps a raid and its follow-ups in the robber turn', () => {
        index = 0
        const actions = [
            action(ActionType.RaidCog, { playerId: 'p1', victimId: 'p2', metadata: { city: 3 } }),
            action(ActionType.DivideSpoils, { playerId: 'p2', pile: noGoods() }),
            action(ActionType.ChooseSpoils, { playerId: 'p1', pile: 0 }),
            action(ActionType.ExpelRaider, {
                playerId: 'p2',
                slot: 0,
                metadata: {
                    raiderId: 'p1',
                    from: 3,
                    destination: 5,
                    revealed: false,
                    blocked: false
                }
            })
        ]
        const entries = historyEntries(actions)
        expect(entries).toHaveLength(1)
        expect(entries[0].kind === 'turn' && entries[0].lines.length).toBe(4)
    })
})
