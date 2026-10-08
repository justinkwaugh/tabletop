import { describe, expect, it } from 'vitest'
import { ActionSource, Visibility, getPrng, type GameAction } from '@tabletop/common'
import { KoggeGameStateValidator, KoggeProjectedStateValidator } from '../model/gameState.js'
import { ActionType } from './actions.js'
import { KoggeRuntime } from './runtime.js'
import { MachineState } from './states.js'
import { chooseStarts, engine, newTable, play, type Table } from './testSupport.js'
import { SailRouteKind } from '../model/gameState.js'
import { noGoods } from '../components/goods.js'
import type { Sail } from '../actions/sail.js'

const spectator = { kind: 'spectator' } as const

function project(table: Table, playerId?: string) {
    const perspective = playerId ? ({ kind: 'player', playerId } as const) : spectator
    return KoggeRuntime.visibility.state.project(table.state, perspective, {
        config: table.game.config
    })
}

function tableWithHiddenRoute(): {
    table: Table
    placerId: string
    city: number
    change: GameAction
} {
    const table = newTable(3)
    chooseStarts(table, [1, 4, 7])
    while (table.state.machineState === MachineState.Bidding) {
        const [playerId] = table.state.activePlayerIds
        const marker = table.state.players.find((player) => player.playerId === playerId)?.markers[
            table.state.bids.length
        ]
        play(table, playerId, { type: ActionType.PlaceBid, markers: [marker] })
    }
    play(table, table.state.activePlayerIds[0], { type: ActionType.MoveGuildMaster, steps: 1 })
    const [placerId] = table.state.activePlayerIds
    const placer = table.state.players.find((player) => player.playerId === placerId)
    const city = placer?.city ?? 0
    const marker = placer?.markers.find((value) => value !== city)
    const [change] = play(table, placerId, { type: ActionType.ChangeRoute, slot: 0, marker })
    return { table, placerId, city, change }
}

describe('Kogge visibility', () => {
    it('shows route markers only to their holder', () => {
        const table = newTable(3)
        const projected = project(table, 'p0')
        expect(projected.players[0].markers).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8])
        expect(projected.players[1]).not.toHaveProperty('markers')
        expect(projected.players[1].markerCount).toBe(9)
        expect(projected.reserve.items).toEqual([])
        expect(projected.reserve.remaining).toBe(table.state.reserve.remaining)
        expect(KoggeProjectedStateValidator.Check(projected)).toBe(true)
    })

    it('hides start cities until everyone has chosen', () => {
        const table = newTable(3)
        play(table, 'p0', { type: ActionType.ChooseStartCity, city: 3 })
        expect(project(table, 'p1').startChoices?.[0]).not.toHaveProperty('city')
        expect(project(table, 'p0').startChoices?.[0].city).toBe(3)
    })

    it('hides a face-down route from everyone but the player who placed it', () => {
        const { table, placerId, city } = tableWithHiddenRoute()
        const hidden = table.state.cities[city].routes[0].hidden
        expect(hidden?.playerId).toBe(placerId)
        const other = table.state.players.find((player) => player.playerId !== placerId)
        expect(project(table, placerId).cities[city].routes[0].hidden?.value).toBe(hidden?.value)
        expect(project(table, other?.playerId).cities[city].routes[0].hidden).not.toHaveProperty(
            'value'
        )
        expect(project(table).cities[city].routes[0].hidden).not.toHaveProperty('value')
    })

    it('redacts the hidden marker from the route change for other players', () => {
        const { table, placerId, change } = tableWithHiddenRoute()
        const other = table.state.players.find((player) => player.playerId !== placerId)
        const forOther = KoggeRuntime.visibility.actions.project(change, {
            kind: 'player',
            playerId: other?.playerId ?? ''
        })
        expect(forOther.type).toBe(ActionType.ChangeRoute)
        expect(forOther).not.toHaveProperty('marker')
        const forPlacer = KoggeRuntime.visibility.actions.project(change, {
            kind: 'player',
            playerId: placerId
        })
        expect(forPlacer).toHaveProperty('marker')
    })

    it('samples a complete exploration state from a player view', () => {
        const { table, placerId } = tableWithHiddenRoute()
        const other = table.state.players.find((player) => player.playerId !== placerId)
        const perspective = { kind: 'player', playerId: other?.playerId ?? '' } as const
        const explored = KoggeRuntime.exploration.createFromProjectedState({
            game: table.game,
            state: project(table, perspective.playerId),
            actions: [],
            perspective,
            random: getPrng(42)
        })
        expect(KoggeGameStateValidator.Check(explored)).toBe(true)
        expect(explored.reserve.items).toHaveLength(table.state.reserve.remaining)
    })

    it('lets the acting player bid and sail from their own view', () => {
        const table = newTable(3)
        chooseStarts(table, [1, 4, 7])
        const asPlayer = (action: Record<string, unknown>) => {
            const [playerId] = table.state.activePlayerIds
            const perspective = { kind: 'player', playerId } as const
            return engine.executeAction({
                game: table.game,
                state: project(table, playerId),
                perspective,
                action: {
                    id: `own-${table.state.actionCount}`,
                    gameId: table.game.id,
                    source: ActionSource.User,
                    playerId,
                    type: String(action.type),
                    ...action
                }
            })
        }
        const [bidder] = table.state.activePlayerIds
        const marker = table.state.players.find((player) => player.playerId === bidder)?.markers[0]
        const local = asPlayer({ type: ActionType.PlaceBid, markers: [marker] })
        expect(local.updatedState.bids).toEqual([{ playerId: bidder, markers: [marker] }])
    })

    it('waits for the host to sail along a hidden route', () => {
        const { table, placerId, city } = tableWithHiddenRoute()
        play(table, placerId, { type: ActionType.EndTurn })
        const [sailorId] = table.state.activePlayerIds
        const edited = structuredClone(table.state)
        const sailor = edited.players.find((player) => player.playerId === sailorId)
        if (!sailor) throw Error('missing sailor')
        sailor.city = city
        if (edited.turn) edited.turn.startCity = city
        table.state = edited
        const perspective = { kind: 'player', playerId: sailorId } as const
        const hiddenSail: Sail = {
            id: 'hidden-sail',
            gameId: table.game.id,
            source: ActionSource.User,
            playerId: sailorId,
            type: ActionType.Sail,
            route: { kind: SailRouteKind.Route, slot: 0 },
            payment: { goods: noGoods(), markers: [] }
        }
        const thrown = (() => {
            try {
                engine.executeAction({
                    game: table.game,
                    state: project(table, sailorId),
                    perspective,
                    action: hiddenSail
                })
            } catch (error) {
                return error
            }
            return undefined
        })()
        expect(Visibility.isUnavailableProjectedValueError(thrown)).toBe(true)
    })
})
