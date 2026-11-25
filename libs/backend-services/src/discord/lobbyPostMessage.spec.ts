import { describe, expect, it } from 'vitest'
import { GameStatus, PlayerStatus, type Game } from '@tabletop/common'
import { ButtonStyle, ComponentType } from 'discord-api-types/v10'
import { lobbyPostUpdate, newLobbyPost } from './lobbyPostMessage.js'

const context = { titleName: '1830', frontendHost: 'https://example.com' }

function openGame(fields: Partial<Game> = {}): Game {
    return {
        id: 'game 1',
        typeId: '1830',
        series: '18xx',
        status: GameStatus.WaitingForPlayers,
        isPublic: true,
        deleted: false,
        ownerId: 'u-1',
        name: 'Rails_and_*stars*',
        players: [
            { id: 'p-1', isHuman: true, userId: 'u-1', name: 'Alice', status: PlayerStatus.Joined },
            { id: 'p-2', isHuman: true, userId: 'u-2', name: 'Bob', status: PlayerStatus.Reserved },
            { id: 'p-3', isHuman: true, name: 'Player 3', status: PlayerStatus.Open },
            { id: 'p-4', isHuman: true, name: 'Player 4', status: PlayerStatus.Open }
        ],
        config: {},
        hotseat: false,
        paceMinutes: 60,
        createdAt: new Date('2026-11-25T12:00:00.000Z'),
        winningPlayerIds: [],
        ...fields
    }
}

describe('newLobbyPost', () => {
    it('mentions the role it is given and links to the join page', () => {
        const post = newLobbyPost(openGame(), context, { nonce: 'n-1', mentionRoleId: 'role-1' })

        expect(post.content).toBe('<@&role-1>')
        expect(post.allowed_mentions).toEqual({ parse: [], roles: ['role-1'] })
        expect(post).toMatchObject({ nonce: 'n-1', enforce_nonce: true })
        const [embed] = post.embeds ?? []
        expect(embed.title).toBe('Rails\\_and\\_\\*stars\\*')
        expect(embed.url).toBe('https://example.com/join/game%201')
        expect(embed.description).toBe('**1830**')
        expect(embed.fields).toEqual([
            { name: 'Seats', value: '2 open of 4', inline: true },
            { name: 'Pace', value: 'Fast · within 1 h', inline: true },
            { name: 'Players', value: 'Alice' }
        ])
        expect(post.components).toEqual([
            {
                type: ComponentType.ActionRow,
                components: [
                    {
                        type: ComponentType.Button,
                        style: ButtonStyle.Link,
                        label: 'Join game',
                        url: 'https://example.com/join/game%201'
                    }
                ]
            }
        ])
    })

    it('mentions nobody without a role', () => {
        const post = newLobbyPost(openGame(), context, { nonce: 'n-1' })

        expect(post.content).toBeUndefined()
        expect(post.allowed_mentions).toEqual({ parse: [], roles: [] })
    })

    it('escapes player names', () => {
        const game = openGame({
            players: [
                {
                    id: 'p-1',
                    isHuman: true,
                    userId: 'u-1',
                    name: '*bold*',
                    status: PlayerStatus.Joined
                },
                { id: 'p-2', isHuman: true, name: 'Player 2', status: PlayerStatus.Open }
            ]
        })
        const [embed] = newLobbyPost(game, context, { nonce: 'n-1' }).embeds ?? []
        expect(embed.fields?.at(-1)).toEqual({ name: 'Players', value: '\\*bold\\*' })
    })
})

describe('lobbyPostUpdate', () => {
    it('leaves the content alone so an edit never mentions the role again', () => {
        expect(lobbyPostUpdate(openGame(), context)).not.toHaveProperty('content')
    })
})
