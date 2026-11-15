import { describe, expect, it } from 'vitest'
import { expectReplayableRecord } from '../../../libs/18xx/test/replayableRecord.js'
import { finishedTurns } from '../../../libs/18xx/test/turnRecord.js'
import { playOut } from '../test/bot.js'
import { kit } from '../test/kit.js'

describe('turn series', () => {
    it('stops growing in a new game, however many turns are taken', () => {
        const game = kit.table(4, 1)
        expect(game.state.turnManager.seriesKeeps).toBe('latest')
        playOut(game, 1, 500, () => expect(game.state.turnManager.series.length).toBeLessThan(8))
        expect(finishedTurns(game)).toBeGreaterThan(100)
    }, 60_000)

    it('leaves a new game’s record open to History Navigation', () => {
        const game = kit.table(4, 1)
        playOut(game, 1, 250)
        expectReplayableRecord(game, game.initialState)
    }, 60_000)

    it('goes on keeping every turn in a game recorded that way', () => {
        const game = kit.table(4, 1)
        const { seriesKeeps: _seriesKeeps, ...turnManager } = game.state.turnManager
        const first = { ...game.state, turnManager }
        game.state = first
        playOut(game, 1, 250)
        const series = game.state.turnManager.series
        expect(series.filter((turn) => turn.end !== undefined)).toHaveLength(finishedTurns(game))
        expect(series.length).toBeGreaterThan(50)
        expectReplayableRecord(game, first)
    }, 60_000)
})
