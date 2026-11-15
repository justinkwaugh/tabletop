import { describe, expect, it } from 'vitest'
import { ActionSource, type GameAction } from '@tabletop/common'
import { ActionType, EconomicTile } from '@tabletop/stellar-horizons-2'
import { recapActions, unreadRecap } from './recap.js'

let next = 0
function action(
    type: string,
    source: ActionSource,
    fields: Partial<GameAction> & Record<string, unknown> = {}
): GameAction {
    return { id: `a${next++}`, gameId: 'g', type, source, ...fields } as GameAction
}
const user = (type: string, playerId: string, fields: Record<string, unknown> = {}) =>
    action(type, ActionSource.User, { playerId, ...fields })
const system = (type: string, fields: Record<string, unknown> = {}) =>
    action(type, ActionSource.System, fields)

describe('recap', () => {
    it('reads what happened since the player last acted, for them and for everyone', () => {
        const actions = [
            user(ActionType.EndPhase, 'p1'),
            user(ActionType.EndPhase, 'p0'),
            system(ActionType.StartPhase),
            system(ActionType.DrawEconomicTile, {
                metadata: { tile: EconomicTile.EarthProduction, earthProduction: [] }
            }),
            system(ActionType.SettleExplorations, { playerId: 'p1', metadata: { settled: [] } }),
            system(ActionType.SettleExplorations, { playerId: 'p0', metadata: { settled: [] } }),
            user(ActionType.Explore, 'p2', { shipId: 'x' }),
            user(ActionType.DeclareAttack, 'p2', { defenderId: 'p0' })
        ]
        expect(recapActions(actions, 'p0').map((entry) => entry.type)).toEqual([
            ActionType.DrawEconomicTile,
            ActionType.SettleExplorations,
            ActionType.DeclareAttack
        ])
        expect(recapActions(actions, 'p0')[1].playerId).toBe('p0')
    })

    it('reads nothing before the player has acted, and nothing in a bare turn start or end', () => {
        expect(recapActions([system(ActionType.DrawEconomicTile)], 'p0')).toEqual([])
        const quiet = [
            user(ActionType.EndPhase, 'p0'),
            system(ActionType.EndTurn, {
                metadata: { year: 2100, victorIds: [], gameOver: false }
            }),
            system(ActionType.StartTurn, {
                metadata: { year: 2110, income: 0, arrivedShipIds: [] }
            })
        ]
        expect(recapActions(quiet, 'p0')).toEqual([])
        const paid = [
            ...quiet,
            system(ActionType.StartTurn, {
                metadata: { year: 2120, income: 5, arrivedShipIds: [] }
            })
        ]
        expect(recapActions(paid, 'p0').map((entry) => entry.type)).toEqual([ActionType.StartTurn])
    })

    it('leaves out what was already read', () => {
        const actions = [
            user(ActionType.EndPhase, 'p0'),
            system(ActionType.RollInitiative),
            system(ActionType.DrawEvent)
        ]
        const recap = recapActions(actions, 'p0')
        expect(unreadRecap(recap, undefined)).toHaveLength(2)
        expect(unreadRecap(recap, recap[0].id).map((entry) => entry.type)).toEqual([
            ActionType.DrawEvent
        ])
        expect(unreadRecap(recap, recap[1].id)).toEqual([])
        expect(unreadRecap(recap, 'gone')).toHaveLength(2)
    })
})
