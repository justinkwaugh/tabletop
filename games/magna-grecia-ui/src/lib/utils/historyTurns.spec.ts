import { describe, expect, it } from 'vitest'
import { ActionSource, type GameAction } from '@tabletop/common'
import { ActionType } from '@tabletop/magna-grecia'
import { historyEntry, historyLines, historyRounds, resupplyText } from './historyTurns.js'

let next = 0
function action(type: ActionType, playerId: string, fields: object = {}): GameAction {
    next += 1
    return {
        id: `a${next}`,
        gameId: 'g',
        source: ActionSource.User,
        type,
        playerId,
        createdAt: new Date(Date.UTC(2026, 9, 1, 0, next)),
        ...fields
    } as GameAction
}

function turn(playerId: string, ...types: ActionType[]): GameAction[] {
    return [...types.map((type) => action(type, playerId)), action(ActionType.EndTurn, playerId)]
}

describe('history rounds', () => {
    it('groups each player turn and counts rounds off ended turns', () => {
        const actions = [
            ...turn('p0', ActionType.PlaceCity, ActionType.PlaceRoad),
            ...turn('p1', ActionType.BuildMarket),
            ...turn('p1'),
            action(ActionType.PlaceRoad, 'p0')
        ]

        const rounds = historyRounds(actions, 2)

        expect(rounds.map((round) => round.round)).toEqual([0, 1])
        expect(
            rounds.map((round) =>
                round.turns.map((turn) => ({
                    playerId: turn.playerId,
                    types: turn.actions.map((action) => action.type),
                    ended: turn.ended
                }))
            )
        ).toEqual([
            [
                {
                    playerId: 'p0',
                    types: [ActionType.PlaceCity, ActionType.PlaceRoad],
                    ended: true
                },
                { playerId: 'p1', types: [ActionType.BuildMarket], ended: true }
            ],
            [
                { playerId: 'p1', types: [], ended: true },
                { playerId: 'p0', types: [ActionType.PlaceRoad], ended: false }
            ]
        ])
    })

    it('dates a turn by its last action, including its end', () => {
        const actions = turn('p0', ActionType.PlaceRoad)
        const [round] = historyRounds(actions, 1)
        expect(round.turns[0].lastAt).toEqual(actions.at(-1)?.createdAt)
    })
})

describe('history entries', () => {
    it('names city tiles by what they did and charges a point each', () => {
        const city = (metadata: object) =>
            historyEntry(
                action(ActionType.PlaceCity, 'p0', {
                    coords: { q: 0, r: 0 },
                    metadata: {
                        cityId: 'C1',
                        founded: false,
                        mergedCityIds: [],
                        foundingMarket: false,
                        oracleChanges: [],
                        ...metadata
                    }
                })
            )

        expect(city({ founded: true, foundingMarket: true })).toMatchObject({
            label: 'Founded a city',
            points: -1,
            foundingMarket: true
        })
        expect(city({ mergedCityIds: ['C2', 'C3'] })?.label).toBe('Joined 3 cities')
        expect(city({ claimVillage: { q: 1, r: 0 } })).toMatchObject({
            label: 'Expanded a city',
            detail: 'beside a village'
        })
    })

    it('gives market costs and sale values as point changes', () => {
        const built = action(ActionType.BuildMarket, 'p0', { metadata: { cost: 3 } })
        const sold = action(ActionType.SellMarket, 'p0', { metadata: { value: 5 } })
        expect(historyEntry(built)?.points).toBe(-3)
        expect(historyEntry(sold)?.points).toBe(5)
    })

    it('leaves empty parts out of a resupply', () => {
        expect(resupplyText(0, 5)).toBe('5 city tiles')
        expect(resupplyText(1, 1)).toBe('1 road and 1 city tile')
    })
})

describe('history lines', () => {
    it('joins roads laid one after another, keeping every oracle they turn', () => {
        const road = (oracleChanges: object[] = []) =>
            action(ActionType.PlaceRoad, 'p0', { metadata: { oracleChanges } })
        const turned = { oracle: { q: 2, r: 0 }, toCityId: 'C1', toPlayerId: 'p0' }
        const actions = [
            road(),
            road([turned]),
            action(ActionType.BuildMarket, 'p0', { metadata: { cost: 2 } }),
            road()
        ]

        const lines = historyLines(actions)

        expect(lines.map((line) => line.entry.label)).toEqual([
            'Built 2 roads',
            'Built a market',
            'Built a road'
        ])
        expect(lines[0].actions).toEqual(actions.slice(0, 2))
        expect(lines[0].entry.oracleChanges).toEqual([turned])
    })
})
