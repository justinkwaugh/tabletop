import { describe, expect, it } from 'vitest'
import {
    Color,
    GameCallKind,
    GameCategory,
    GameResult,
    GameStatus,
    PlayerStatus,
    UserStatus,
    type Game,
    type GameMetadata,
    type User
} from '@tabletop/common'
import { bgStatsPlayUrl } from './bgStats.js'

const metadata: GameMetadata = {
    name: 'Game & Title',
    bggId: 249381,
    hasScores: true,
    designer: 'Designer',
    description: '',
    year: '2018',
    minPlayers: 2,
    maxPlayers: 5,
    defaultPlayerCount: 4,
    version: '1.0.0',
    beta: false
}

const user: User = {
    id: 'alice',
    status: UserStatus.Active,
    roles: [],
    externalIds: [],
    preferences: {
        preventWebNotificationPrompt: false,
        preferredColorsEnabled: false,
        preferredColors: [Color.Red],
        bgStatsEnabled: true
    }
}

function game(overrides: Partial<Game> = {}): Game {
    return {
        id: 'play-1',
        typeId: 'test-title',
        name: 'Friday evening',
        status: GameStatus.Finished,
        result: GameResult.Win,
        isPublic: false,
        deleted: false,
        ownerId: 'alice',
        config: {},
        hotseat: false,
        createdAt: new Date('2026-10-01T12:00:00Z'),
        finishedAt: new Date('2026-10-27T01:02:03+02:00'),
        players: ['alice', 'bob'].map((id) => ({
            id: `seat-${id}`,
            userId: id,
            name: id === 'alice' ? 'Alice & Zoë' : 'Bob',
            status: PlayerStatus.Joined,
            isHuman: true
        })),
        winningPlayerIds: ['seat-alice'],
        finalScores: { 'seat-alice': 12, 'seat-bob': -4.5 },
        ...overrides
    }
}

function playData(game: Game, title: GameMetadata = metadata): unknown {
    const url = bgStatsPlayUrl(game, title, user)
    expect(url).toBeDefined()
    const data = new URL(url!).searchParams.get('data')
    return JSON.parse(data!)
}

describe('BG Stats play links', () => {
    it('encodes the BGG identity and final scores without adding elapsed duration', () => {
        expect(playData(game())).toEqual({
            sourceName: 'Tabletop',
            sourcePlayId: 'play-1',
            playDate: '2026-10-26 23:02:03',
            game: {
                name: 'Game & Title',
                sourceGameId: 'test-title',
                bggId: 249381,
                noPoints: false,
                highestWins: true
            },
            players: [
                { name: 'Alice & Zoë', sourcePlayerId: 'user:alice', score: 12, winner: true },
                { name: 'Bob', sourcePlayerId: 'user:bob', score: -4.5, winner: false }
            ]
        })
    })

    it('requires opt-in and participation', () => {
        for (const viewer of [
            undefined,
            { ...user, preferences: undefined },
            { ...user, preferences: { ...user.preferences!, bgStatsEnabled: undefined } },
            { ...user, preferences: { ...user.preferences!, bgStatsEnabled: false } },
            { ...user, id: 'spectator' }
        ]) {
            expect(bgStatsPlayUrl(game(), metadata, viewer)).toBeUndefined()
        }
    })

    it('excludes unfinished, abandoned, deleted, and exploration games', () => {
        for (const overrides of [
            { status: GameStatus.Started },
            { result: GameResult.Abandoned },
            { result: undefined },
            { deleted: true },
            { category: GameCategory.Exploration }
        ]) {
            expect(bgStatsPlayUrl(game(overrides), metadata, user)).toBeUndefined()
        }
        expect(bgStatsPlayUrl(game(), undefined, user)).toBeUndefined()
    })

    it('preserves tied winners and real scores of one without inferring synthetic scoring', () => {
        expect(
            playData(
                game({
                    result: GameResult.Draw,
                    winningPlayerIds: ['seat-alice', 'seat-bob'],
                    finalScores: { 'seat-alice': 1, 'seat-bob': 1 }
                })
            )
        ).toMatchObject({
            players: [
                { sourcePlayerId: 'user:alice', score: 1, winner: true },
                { sourcePlayerId: 'user:bob', score: 1, winner: true }
            ]
        })
    })

    it('retains zero scores and authoritative winners when equal scores have a tiebreaker', () => {
        expect(playData(game({ finalScores: { 'seat-alice': 0, 'seat-bob': 0 } }))).toMatchObject({
            players: [
                { score: 0, winner: true },
                { score: 0, winner: false }
            ]
        })
    })

    it('omits synthetic scores for titles that declare win/loss-only scoring', () => {
        expect(
            playData(game({ finalScores: { 'seat-alice': 1, 'seat-bob': 0 } }), {
                ...metadata,
                hasScores: false
            })
        ).toMatchObject({
            game: { noPoints: true },
            players: [
                { name: 'Alice & Zoë', sourcePlayerId: 'user:alice', winner: true },
                { name: 'Bob', sourcePlayerId: 'user:bob', winner: false }
            ]
        })
        expect(JSON.stringify(playData(game(), { ...metadata, hasScores: false }))).not.toContain(
            '"score":'
        )
    })

    it('keeps older catalog entries usable without inferring scores or a BGG identity', () => {
        const play = playData(game(), { ...metadata, hasScores: undefined, bggId: undefined })
        expect(play).toMatchObject({
            game: { name: 'Game & Title', sourceGameId: 'test-title' },
            players: [{ winner: true }, { winner: false }]
        })
        for (const field of ['score', 'noPoints', 'highestWins', 'bggId']) {
            expect(JSON.stringify(play)).not.toContain(`"${field}":`)
        }
    })

    it('leaves unavailable historical scores unset instead of inventing zeroes', () => {
        const play = playData(game({ finalScores: undefined }))
        expect(play).toMatchObject({
            game: { noPoints: false },
            players: [{ winner: true }, { winner: false }]
        })
        expect(JSON.stringify(play)).not.toContain('"score":')
    })

    it('exports a conceded result without treating intermediate scores as final scores', () => {
        const play = playData(
            game({
                call: {
                    kind: GameCallKind.Conceded,
                    initiatorPlayerId: 'seat-bob',
                    declaredWinnerId: 'seat-alice',
                    approvingPlayerIds: ['seat-bob'],
                    decliningPlayerIds: []
                }
            })
        )
        expect(play).toMatchObject({ players: [{ winner: true }, { winner: false }] })
        expect(JSON.stringify(play)).not.toContain('"score":')
    })

    it('uses account identities across plays', () => {
        const nextGame = game({
            id: 'play-2',
            players: game().players.map((player) => ({ ...player, id: `new-${player.id}` })),
            winningPlayerIds: ['new-seat-alice']
        })
        expect(playData(nextGame)).toMatchObject({
            sourcePlayId: 'play-2',
            players: [{ sourcePlayerId: 'user:alice' }, { sourcePlayerId: 'user:bob' }]
        })
    })

    it('excludes completed hotseat games even for an opted-in owner and participant', () => {
        expect(
            bgStatsPlayUrl(
                game({
                    hotseat: true,
                    players: game().players.map((player) => ({ ...player, userId: 'alice' }))
                }),
                metadata,
                user
            )
        ).toBeUndefined()
    })
})
