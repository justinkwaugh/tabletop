import { describe, expect, it } from 'vitest'
import { ActionSource, assert } from '@tabletop/common'
import { engine } from '../testing/engine.js'
import { testGame } from '../testing/game.js'
import { OathGameStateValidator, type OathProjectedState } from '../model/gameState.js'
import recorded from './tests/recorded-0.2.0.json'

const game = testGame(recorded.players, { config: recorded.config })

describe('a game recorded under logic 0.2.0 replays as it was played', () => {
    it.each(recorded.segments)('$name', (segment) => {
        assert(OathGameStateValidator.Check(segment.initial), 'The recorded state is canonical')
        expect(segment.initial.oathRevision).toBeUndefined()

        let state: OathProjectedState = structuredClone(segment.initial)
        const processed: string[] = []
        for (const action of segment.actions) {
            const result = engine.executeCanonicalAction({
                game,
                state,
                action: { ...action, source: ActionSource.User }
            })
            processed.push(...result.processedActions.map((a) => `${a.type}/${a.source}`))
            state = result.updatedState
        }

        expect(processed).toEqual(segment.processed)
        expect(state).toEqual(segment.expected)
    })
})
