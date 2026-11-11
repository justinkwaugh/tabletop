import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { GameEngine } from '@tabletop/common'
import { Definition } from './definition/gameDefinition.js'

type Recorded = { game: never; initialState: never; actions: never[] }

function replay(file: string) {
    const { game, initialState, actions }: Recorded = JSON.parse(
        readFileSync(new URL(`../test/fixtures/${file}`, import.meta.url), 'utf8')
    )
    const engine = new GameEngine(Definition.runtime)
    let state = initialState
    for (const action of actions)
        state = engine.executeCanonicalAction({ game, state, action }).updatedState
    const final: {
        machineState: string
        phaseId: string
        finalWealth?: { playerId: string; items: { value: number }[] }[]
    } = state
    return {
        final,
        wealth: Object.fromEntries(
            (final.finalWealth ?? []).map(({ playerId, items }) => [
                playerId,
                items.reduce((sum, item) => sum + item.value, 0)
            ])
        )
    }
}

it('plays a recorded game through to the broken bank', () => {
    const { final, wealth } = replay('finished-game.json')
    expect(final.machineState).toBe('GameOver')
    expect(final.phaseId).toBe('12')
    expect(wealth).toEqual({ '1761': 10256, '2122': 10301, '4311': 7757 })
}, 60_000)

it('plays a recorded game through to a bankruptcy', () => {
    const { final, wealth } = replay('bankrupt-game.json')
    expect(final.machineState).toBe('GameOver')
    expect(wealth).toEqual({ '859': 1793, '1377': 1054, '14945': 376 })
}, 60_000)
