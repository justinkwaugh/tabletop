import { describe, expect, it } from 'vitest'
import { GameStatus, GameStorage } from '@tabletop/common'
import { scenariosFrom } from './harnessScenarios.js'

const START = '2026-10-14T12:00:00.000Z'

const game = {
    id: 'scenario-guns',
    typeId: 'title',
    name: 'Guns',
    ownerId: 'owner',
    status: GameStatus.Started,
    isPublic: false,
    deleted: false,
    storage: GameStorage.Local,
    category: 'Default',
    players: [],
    winningPlayerIds: [],
    config: {},
    hotseat: true,
    createdAt: START,
    startedAt: START
}
const state = {
    systemVersion: 1,
    id: 'state',
    gameId: 'scenario-guns',
    activePlayerIds: [],
    winningPlayerIds: [],
    actionCount: 0,
    actionChecksum: 0,
    players: [],
    machineState: 'Commanding',
    turnManager: { series: [], turnOrder: [], turnCounts: {} },
    prng: { seed: 1, invocations: 0 }
}

describe('harness scenarios', () => {
    it('are named for their files, in order, whatever folder they are found in', () => {
        const read = async () => ({ game, state, actions: [] })
        const names = scenariosFrom({
            '/src/scenarios/second-attack.json': read,
            '/src/scenarios/artillery-pair-narrow.json': read
        }).map((scenario) => scenario.name)
        expect(names).toEqual(['Artillery pair narrow', 'Second attack'])
    })

    it('read the dates a JSON file holds as strings back as dates', async () => {
        const [scenario] = scenariosFrom({
            '/src/scenarios/guns.json': async () => ({ game, state, actions: [] })
        })
        const data = await scenario.load()
        expect(data.game.createdAt).toEqual(new Date(START))
        expect(data.state.actionCount).toBe(0)
        expect(data.actions).toEqual([])
    })

    it('refuse a state that belongs to another game', async () => {
        const [scenario] = scenariosFrom({
            '/src/scenarios/guns.json': async () => ({
                game,
                state: { ...state, gameId: 'other' },
                actions: []
            })
        })
        await expect(scenario.load()).rejects.toThrow('belongs to game other')
    })

    it('refuse a file that does not hold a game, its state and its actions', async () => {
        const [scenario] = scenariosFrom({ '/src/scenarios/broken.json': async () => ({ game }) })
        await expect(scenario.load()).rejects.toThrow()
    })
})
