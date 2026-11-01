import { GameVisibility, type GameInfo } from '@tabletop/common'
import { DickeKartoffelnConfigurator } from './configurator.js'
import { GAME_VERSION } from './version.js'

export const DickeKartoffelnInfo: GameInfo = {
    id: 'dicke-kartoffeln',
    metadata: {
        name: 'Dicke Kartoffeln',
        designer: 'Doris Matthäus & Frank Nestel',
        description:
            'Run a small potato farm through the seasons. Take compost, plough and sow Amalie, Biola or Chris, decide whether fertilizer and poison are worth what they do to the soil, and sell on a market every farmer floods together. Will you be the richest farmer, the best organic farmer, or both?',
        year: '1991',
        minPlayers: 2,
        maxPlayers: 6,
        defaultPlayerCount: 4,
        version: GAME_VERSION,
        beta: true,
        visibility: GameVisibility.Alpha
    },
    configurator: new DickeKartoffelnConfigurator()
}
