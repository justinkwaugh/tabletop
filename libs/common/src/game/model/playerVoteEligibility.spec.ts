import { describe, expect, it } from 'vitest'
import { GameStatus } from './game.js'
import { callRequestIneligibility, playerVoteIneligibility } from './playerVoteEligibility.js'

const tournament = { tournamentId: 't', stageId: 's', tableId: '00001', scheduleId: 'x' }
const game = { hotseat: false, status: GameStatus.Started }

describe('player vote eligibility', () => {
    it('refuses every vote in a tournament game', () => {
        expect(playerVoteIneligibility({ ...game, tournament })).toBeDefined()
        expect(callRequestIneligibility({ ...game, tournament })).toBeDefined()
    })

    it('lets the players of a knockout game concede, but not vote to undo', () => {
        const knockout = { ...game, tournament, concedable: true as const }
        expect(callRequestIneligibility(knockout)).toBeUndefined()
        expect(playerVoteIneligibility(knockout)).toBeDefined()
        expect(callRequestIneligibility({ ...knockout, status: GameStatus.Finished })).toBe(
            'the game is over'
        )
    })
})
