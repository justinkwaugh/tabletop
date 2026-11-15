import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { GameEngine } from '@tabletop/common'
import { Definition } from './definition/gameDefinition.js'
import { Market1870 } from './stockMarket.js'

type Recorded = { game: never; initialState: never; actions: never[] }

// A whole game of four players, ending when the bank breaks: seven connection runs, price
// protection, redemption and all eight phases.
const { game, initialState, actions }: Recorded = JSON.parse(
    readFileSync(new URL('../test/fixtures/finished-game.json', import.meta.url), 'utf8')
)

it('plays a recorded game through to the broken bank', () => {
    const engine = new GameEngine(Definition.runtime)
    let state = initialState
    for (const action of actions)
        state = engine.executeCanonicalAction({ game, state, action }).updatedState
    const final: {
        machineState: string
        phaseId: string
        destinationRunsMade: string[]
        finalWealth?: { playerId: string; items: { value: number }[] }[]
        stockMarket: Parameters<typeof Market1870.companySpace>[0]
    } = state
    expect(final.machineState).toBe('GameOver')
    expect(final.phaseId).toBe('12')
    expect(final.destinationRunsMade.length).toBeGreaterThan(5)
    expect(
        Object.fromEntries(
            (final.finalWealth ?? []).map(({ playerId, items }) => [
                playerId,
                items.reduce((sum, item) => sum + item.value, 0)
            ])
        )
    ).toEqual({ '4395': 6916, '7438': 10149, '9263': 12140, '18843': 6747 })
}, 60_000)
