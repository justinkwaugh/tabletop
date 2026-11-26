import { describe, expect, it } from 'vitest'
import * as Type from 'typebox'
import {
    ConfigOptionType,
    GameStatus,
    PlayerStatus,
    type Game,
    type GameConfigurator
} from '@tabletop/common'
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
        expect(embed.description).toBe('**1830** · 2 of 4 seats open · Fast · 1 h\nPlayers: Alice')
        expect(embed).not.toHaveProperty('fields')
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
        expect(embed.description?.split('\n').at(-1)).toBe('Players: \\*bold\\*')
    })
})

describe('options', () => {
    const configurator: GameConfigurator = {
        schema: Type.Object({}),
        options: [
            {
                id: 'optionalRules',
                name: 'Optional rules',
                description: '',
                type: ConfigOptionType.Boolean,
                default: false
            },
            {
                id: 'variant',
                name: 'Variant',
                description: '',
                type: ConfigOptionType.List,
                default: 'base',
                options: [
                    { name: 'Base game', value: 'base' },
                    { name: 'Short (no 6-trains)', value: 'short' }
                ]
            },
            {
                id: 'privates',
                name: 'Private draft',
                description: '',
                type: ConfigOptionType.Boolean,
                default: true
            }
        ],
        validateConfig() {},
        updateConfig() {}
    }

    function lines(config: Game['config']) {
        const game = openGame({ config })
        return lobbyPostUpdate(game, { ...context, configurator }).embeds?.[0].description?.split(
            '\n'
        )
    }

    it('shows no options for a game at the standard settings', () => {
        expect(lines({ optionalRules: false, variant: 'base', privates: true })).toEqual([
            '**1830** · 2 of 4 seats open · Fast · 1 h',
            'Players: Alice'
        ])
    })

    it('shows only the options away from the standard on one line, before the players', () => {
        expect(lines({ optionalRules: true, variant: 'short', privates: false })).toEqual([
            '**1830** · 2 of 4 seats open · Fast · 1 h',
            'Options: Optional rules · Variant\\: Short \\(no 6\\-trains\\) · Private draft\\: No',
            'Players: Alice'
        ])
    })

    it('shows no options when the title is not loaded', () => {
        const game = openGame({ config: { optionalRules: true } })
        const description = lobbyPostUpdate(game, context).embeds?.[0].description
        expect(description).not.toContain('Options')
    })
})

describe('lobbyPostUpdate', () => {
    it('leaves the content alone so an edit never mentions the role again', () => {
        expect(lobbyPostUpdate(openGame(), context)).not.toHaveProperty('content')
    })
})
