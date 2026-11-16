import { expect, it } from 'vitest'
import { GameResult, GameStatus, GameStorage, type Game, type GameState } from '@tabletop/common'
import { localGameRecord } from './localGameRecord.js'

function game(overrides: Partial<Game> = {}): Game {
    return {
        id: 'g',
        name: 'Test hotseat',
        typeId: 'test',
        ownerId: 'user',
        status: GameStatus.Started,
        isPublic: false,
        deleted: false,
        hotseat: true,
        storage: GameStorage.Local,
        config: {},
        createdAt: new Date('2026-11-16T01:34:17Z'),
        winningPlayerIds: [],
        activePlayerIds: ['p1'],
        players: [],
        ...overrides
    }
}

function state(overrides: Partial<GameState> = {}): GameState {
    return {
        id: 's',
        gameId: 'g',
        activePlayerIds: [],
        winningPlayerIds: [],
        actionCount: 22,
        ...overrides
    } as GameState
}

const ended = new Date('2026-11-16T01:39:00Z')

it('finishes the game when its state has a result', () => {
    const record = localGameRecord(
        game(),
        state({ result: GameResult.Win, winningPlayerIds: ['p2'] }),
        ended
    )

    expect(record).toMatchObject({
        status: GameStatus.Finished,
        result: GameResult.Win,
        winningPlayerIds: ['p2'],
        activePlayerIds: [],
        finishedAt: ended,
        everFinished: true
    })
})

it('keeps the time the game first finished', () => {
    const first = new Date('2026-11-16T01:38:00Z')
    const record = localGameRecord(
        game({ status: GameStatus.Finished, finishedAt: first, result: GameResult.Win }),
        state({ result: GameResult.Win, winningPlayerIds: ['p2'] }),
        ended
    )

    expect(record.finishedAt).toBe(first)
})

it('reopens a finished game whose ending was undone', () => {
    const record = localGameRecord(
        game({
            status: GameStatus.Finished,
            finishedAt: ended,
            result: GameResult.Win,
            winningPlayerIds: ['p2'],
            everFinished: true
        }),
        state({ activePlayerIds: ['p1'] }),
        ended
    )

    expect(record.status).toBe(GameStatus.Started)
    expect(record.result).toBeUndefined()
    expect(record.finishedAt).toBeUndefined()
    expect(record.winningPlayerIds).toEqual([])
    expect(record.activePlayerIds).toEqual(['p1'])
})

it('leaves a game in progress started', () => {
    const record = localGameRecord(game(), state({ activePlayerIds: ['p2'] }), ended)

    expect(record.status).toBe(GameStatus.Started)
    expect(record.finishedAt).toBeUndefined()
    expect(record.activePlayerIds).toEqual(['p2'])
})
