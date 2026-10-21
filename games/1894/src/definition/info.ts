import { EighteenXXPreferenceDefinition } from '@tabletop/18xx'
import { GameVisibility, type GameInfo } from '@tabletop/common'
import { EighteenNinetyFourConfigurator } from './gameConfig.js'
import { GAME_VERSION } from './version.js'

export const EighteenNinetyFourInfo: GameInfo = {
    preferences: EighteenXXPreferenceDefinition,
    id: '1894',
    metadata: {
        name: '1894',
        designer: 'Jan Kłos',
        year: '2024',
        description:
            'Railway companies in north-eastern France and Belgium, from Paris to London, Brussels and Luxembourg.',
        minPlayers: 3,
        maxPlayers: 4,
        defaultPlayerCount: 4,
        version: GAME_VERSION,
        beta: true,
        visibility: GameVisibility.Beta
    },
    configurator: new EighteenNinetyFourConfigurator()
}
