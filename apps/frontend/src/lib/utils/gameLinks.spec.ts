import { describe, expect, it } from 'vitest'
import { GameStatus, GameStorage, type Game } from '@tabletop/common'
import { gameShareLink } from './gameLinks'

function game(overrides: Partial<Game> = {}): Game {
    return {
        id: 'g1',
        name: 'Game',
        typeId: 'test',
        ownerId: 'user',
        status: GameStatus.WaitingForPlayers,
        isPublic: false,
        deleted: false,
        hotseat: false,
        storage: GameStorage.Remote,
        config: {},
        createdAt: new Date('2026-09-01'),
        players: [],
        winningPlayerIds: [],
        ...overrides
    }
}

describe('game share link', () => {
    it('invites to an open public or unlisted game', () => {
        expect(gameShareLink(game({ isPublic: true }))).toEqual({
            path: '/join/g1',
            kind: 'invite'
        })
        expect(gameShareLink(game({ isPublic: true, unlisted: true }))).toEqual({
            path: '/join/g1',
            kind: 'invite'
        })
    })

    it('links to the game itself once it has started', () => {
        for (const status of [GameStatus.Started, GameStatus.Finished]) {
            expect(gameShareLink(game({ status }))).toEqual({ path: '/game/g1', kind: 'game' })
            expect(gameShareLink(game({ isPublic: true, status }))).toEqual({
                path: '/game/g1',
                kind: 'game'
            })
        }
    })

    it('has no link for a waiting game nobody can join by link', () => {
        expect(gameShareLink(game())).toBeUndefined()
        expect(gameShareLink(game({ isPublic: true, parentId: 'g0' }))).toBeUndefined()
    })

    it('has no link for games only this device or nobody can open', () => {
        expect(gameShareLink(game({ hotseat: true, storage: GameStorage.Local }))).toBeUndefined()
        expect(gameShareLink(game({ deleted: true }))).toBeUndefined()
        expect(gameShareLink(game({ status: GameStatus.Archived }))).toBeUndefined()
    })
})
