import { describe, expect, it } from 'vitest'
import {
    GamePace,
    GameStatus,
    GameVisibility,
    PlayerStatus,
    type Game,
    type GameMetadata
} from '@tabletop/common'
import { parseLobbyChannels, PostedLobbies } from './postedLobbies.js'

const channels = { '18xx': { channelId: 'lobby-1', roleId: 'role-1' } }
const everyPace = { channelId: 'all', roleId: 'role-all' }
const live = { channelId: 'live', roleId: 'role-live', paces: [GamePace.Live] }
const async = {
    channelId: 'async',
    roleId: 'role-async',
    paces: [GamePace.Fast, GamePace.Brisk, GamePace.Daily, GamePace.Relaxed]
}

function metadata(visibility: GameVisibility): GameMetadata {
    return {
        name: 'Title',
        designer: 'Designer',
        description: 'A title',
        year: '2026',
        minPlayers: 2,
        maxPlayers: 4,
        defaultPlayerCount: 4,
        version: '1.0.0',
        beta: visibility === GameVisibility.Beta,
        visibility
    }
}

const titles: Record<string, GameMetadata> = {
    '1830': metadata(GameVisibility.Public),
    '1850': metadata(GameVisibility.Beta),
    '18new': metadata(GameVisibility.Alpha)
}
const lobbies = new PostedLobbies(channels, (titleId) => titles[titleId])

function openGame(fields: Partial<Game> = {}): Game {
    return {
        id: 'game-1',
        typeId: '1830',
        series: '18xx',
        status: GameStatus.WaitingForPlayers,
        isPublic: true,
        deleted: false,
        ownerId: 'u-1',
        name: 'Rails',
        players: [{ id: 'p-1', isHuman: true, name: 'Player 1', status: PlayerStatus.Open }],
        config: {},
        hotseat: false,
        createdAt: new Date('2026-11-25T12:00:00.000Z'),
        winningPlayerIds: [],
        ...fields
    }
}

describe('PostedLobbies', () => {
    it("finds the channel of an open game's lobby", () => {
        expect(lobbies.channelsFor(openGame())).toEqual([channels['18xx']])
    })

    it.each([
        ['live', 15, [everyPace, live]],
        ['fast', 60, [everyPace, async]],
        ['daily', 24 * 60, [everyPace, async]],
        ['with no pace set (daily)', undefined, [everyPace, async]]
    ])("finds each of the lobby's channels that lists a %s game", (_, paceMinutes, expected) => {
        const byPace = new PostedLobbies(
            { '18xx': [everyPace, live, async] },
            (titleId) => titles[titleId]
        )

        expect(byPace.channelsFor(openGame({ paceMinutes }))).toEqual(expected)
    })

    it.each([
        ['started', { status: GameStatus.Started }],
        ['with its seats filled', { status: GameStatus.WaitingToStart }],
        ['unlisted', { unlisted: true as const }],
        ['invite-only', { isPublic: false }],
        ['deleted', { deleted: true }],
        ['in another lobby', { series: 'gipf' }],
        ['in no lobby', { series: undefined }],
        ['of a Beta title', { typeId: '1850' }],
        ['of an Alpha title', { typeId: '18new' }],
        ['of a title not loaded', { typeId: 'unknown' }]
    ])('has none for a game %s', (_, fields) => {
        expect(lobbies.channelsFor(openGame(fields))).toEqual([])
    })

    it('has none without a game', () => {
        expect(lobbies.channelsFor(undefined)).toEqual([])
    })

    it('lists the posted lobbies', () => {
        expect(lobbies.seriesIds()).toEqual(['18xx'])
    })
})

describe('parseLobbyChannels', () => {
    it('reads the channels by lobby', () => {
        expect(parseLobbyChannels(JSON.stringify(channels))).toEqual(channels)
    })

    it('reads several channels for a lobby, with their paces', () => {
        const several = { '18xx': [everyPace, live, async] }
        expect(parseLobbyChannels(JSON.stringify(several))).toEqual(several)
    })

    it('refuses an unknown pace', () => {
        const json = JSON.stringify({ '18xx': [{ channelId: 'c', paces: ['slow'] }] })
        expect(() => parseLobbyChannels(json)).toThrow()
    })

    it('has none when unset', () => {
        expect(parseLobbyChannels(undefined)).toEqual({})
    })

    it('refuses a lobby without a channel', () => {
        expect(() => parseLobbyChannels(JSON.stringify({ '18xx': { roleId: 'r' } }))).toThrow()
    })
})
