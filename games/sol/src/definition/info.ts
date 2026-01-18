import type { GameInfo } from '@tabletop/common'
import { SolConfigurator } from './configurator.js'

export const SolInfo: GameInfo = {
    id: 'sol',
    metadata: {
        name: 'Sol: Last Days of a Star',
        designer: 'Ryan and Sean Spangler, Jodi Sweetman',
        description:
            'Sol: Last Days of a Star is a board game for one to five players where each player represents a different planetary effort to transmit as much energy from the Sun back to their Ark so they can try to escape the solar system before the Sun explodes!',
        year: '2017',
        minPlayers: 2,
        maxPlayers: 5,
        defaultPlayerCount: 4,
        version: '1.0.0',
        beta: false
    },
    configurator: new SolConfigurator()
}
