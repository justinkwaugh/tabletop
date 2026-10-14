import { describe, expect, it } from 'vitest'
import { createNoteGame, step } from '../game/engine/tests/noteGame.js'
import type { GameAction } from '../game/engine/gameAction.js'
import { startingPosition, startingPositionFile } from './scenarios.js'

function played(...actions: GameAction[]) {
    const { engine, game, state } = createNoteGame()
    let current = state
    for (const action of actions) {
        current = engine.executeCanonicalAction({ game, state: current, action }).updatedState
    }
    return { engine, game, state: current }
}

describe('a starting position', () => {
    it('is its own game, with nothing behind it', () => {
        const { game, state } = played(step('s1', 'note-game', 'p1'), step('s2', 'note-game', 'p2'))
        expect(state.actionCount).toBe(2)
        const {
            game: scenarioGame,
            state: start,
            actions
        } = startingPosition({
            slug: 'third-step',
            name: 'Third step',
            game: { ...game, state },
            state
        })
        expect(scenarioGame.id).toBe('scenario-third-step')
        expect(scenarioGame.name).toBe('Third step')
        expect(scenarioGame.state).toBeUndefined()
        expect(scenarioGame.activePlayerIds).toEqual(state.activePlayerIds)
        expect(start.gameId).toBe('scenario-third-step')
        expect(start.actionCount).toBe(0)
        expect(start.actionChecksum).toBe(0)
        expect(start.turnManager.series).toEqual([
            { type: 'turn', playerId: state.activePlayerIds[0], start: 0 }
        ])
        expect(actions).toEqual([])
        expect(state.actionCount).toBe(2)
    })

    it('restarts every record of where groups of actions began, a title’s rounds included', () => {
        const { game, state } = played(step('s1', 'note-game', 'p1'))
        const rounds = {
            series: [
                { type: 'round', start: 0, end: 4, number: 1 },
                { type: 'round', start: 4, number: 2 }
            ]
        }
        const { state: start } = startingPosition({
            slug: 'round-two',
            name: 'Round two',
            game,
            state: { ...state, rounds }
        })
        expect(start.rounds).toEqual({ series: [{ type: 'round', start: 0, number: 2 }] })
    })

    it('is played on from its first action', () => {
        const { engine, game, state } = played(step('s1', 'note-game', 'p1'))
        const scenario = startingPosition({ slug: 'second-step', name: 'Second step', game, state })
        const player = scenario.state.activePlayerIds[0]
        const { updatedState } = engine.executeCanonicalAction({
            game: scenario.game,
            state: scenario.state,
            action: { ...step('s2', scenario.game.id, player), index: 0 }
        })
        expect(updatedState.actionCount).toBe(1)
    })

    it('is written to the file named for it', () => {
        const { game, state } = played(step('s1', 'note-game', 'p1'))
        const file = startingPositionFile({ slug: 'second-step', name: 'Second step', game, state })
        expect(file.fileName).toBe('second-step.json')
        expect(JSON.parse(file.contents)).toEqual(
            JSON.parse(
                JSON.stringify(
                    startingPosition({ slug: 'second-step', name: 'Second step', game, state })
                )
            )
        )
    })
})
