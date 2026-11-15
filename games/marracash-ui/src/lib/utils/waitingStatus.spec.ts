import { describe, expect, it } from 'vitest'
import { startedGameState } from '$lib/testing/startedGameState.js'
import { waitingStatus } from './waitingStatus.js'

describe('waitingStatus', () => {
    it('offers only an auction in the opening round, without reading hidden cash', () => {
        const state = startedGameState('waiting-status', 4)
        const status = waitingStatus(state, () => undefined)
        expect(status).toEqual({
            kind: 'turn',
            playerId: state.activePlayerIds[0],
            secondAction: false,
            options: ['auction']
        })
    })

    it('leaves out the auction when visible cash is below the minimum bid', () => {
        const state = startedGameState('waiting-status', 4)
        expect(waitingStatus(state, () => 50)).toMatchObject({ kind: 'turn', options: [] })
    })
})
