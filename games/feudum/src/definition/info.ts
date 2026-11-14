import { GameVisibility, type GameInfo } from '@tabletop/common'
import { GAME_VERSION } from './version.js'

export const FeudumInfo: GameInfo = {
    id: 'feudum',
    metadata: {
        name: 'Feudum',
        bggId: 163839,
        hasScores: true,
        designer: 'Mark Swanson · Art by Justin Schultz',
        publisher: { name: 'Odd Bird Games', url: 'https://oddbirdgames.com/' },
        description:
            'Move pawns across a medieval realm and work the six interlocking guilds, pushing and pulling goods through an economy that every player shares.',
        year: '2018',
        minPlayers: 2,
        maxPlayers: 5,
        defaultPlayerCount: 4,
        version: GAME_VERSION,
        beta: true,
        visibility: GameVisibility.Alpha
    },
    configurator: undefined
}
