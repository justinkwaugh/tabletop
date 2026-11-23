import { describe, expect, it } from 'vitest'
import {
    createCallGameAction,
    gameCallOf,
    type Game,
    type GameAction,
    type GameCall
} from '@tabletop/common'
import { createNoteGame, step, type NoteGameState } from '@tabletop/common/test-fixtures/note-game'
import { openNoteSession } from './tests/noteGameSession.fixture.js'
import { settle } from './tests/privateHandSession.fixture.js'

type PlayedGame = { game: Game; state: NoteGameState; actions: GameAction[]; call?: GameCall }

function playNoteGame({ conceded }: { conceded: boolean }): PlayedGame {
    const { game, state, engine } = createNoteGame()
    let current = state
    const actions: GameAction[] = []
    const play = (action: GameAction) => {
        const result = engine.executeCanonicalAction({
            game,
            state: current,
            action: { ...action, index: current.actionCount }
        })
        current = result.updatedState
        actions.push(...result.processedActions)
    }
    play(step('s1', game.id, 'p1'))
    if (!conceded) return { game, state: current, actions }

    const concession = createCallGameAction({
        gameId: game.id,
        ballot: {
            initiatorPlayerId: 'p1',
            declaredWinnerId: 'p2',
            approvingPlayerIds: ['p1'],
            decliningPlayerIds: []
        },
        players: game.players.slice(0, 2)
    })
    play(concession)
    const call = gameCallOf(concession)
    return { game: { ...game, call }, state: current, actions, call }
}

// The site opens a game with its state and no actions, and loads its history afterwards.
function openBeforeHistory({ game, state }: PlayedGame) {
    return openNoteSession({ game, state, actions: [], historyComplete: false })
}

function openWithHistory({ game, state, actions }: PlayedGame) {
    return openNoteSession({ game, state, actions })
}

describe('GameSession gameCall', () => {
    it('is the recorded call when a conceded game opens before its history', async () => {
        const played = playNoteGame({ conceded: true })
        const { session, dispose } = openBeforeHistory(played)
        try {
            await settle(session)
            expect(session.gameCall).toEqual(played.call)
        } finally {
            dispose()
        }
    })

    it('is the call Action behind the state when the history is loaded', async () => {
        const played = playNoteGame({ conceded: true })
        const { session, dispose } = openWithHistory(played)
        try {
            await settle(session)
            expect(session.gameCall).toEqual(played.call)
        } finally {
            dispose()
        }
    })

    it('is nothing at the start of a conceded game viewed in history', async () => {
        const { session, dispose } = openWithHistory(playNoteGame({ conceded: true }))
        try {
            await settle(session)
            await session.history.goToBeginning()
            await settle(session)
            expect(session.gameState.actionCount).toBe(0)
            expect(session.gameCall).toBeUndefined()
        } finally {
            dispose()
        }
    })

    it('is nothing for a game still playing that opens before its history', async () => {
        const { session, dispose } = openBeforeHistory(playNoteGame({ conceded: false }))
        try {
            await settle(session)
            expect(session.gameCall).toBeUndefined()
        } finally {
            dispose()
        }
    })
})
