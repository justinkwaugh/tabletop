import { GameVisibility } from '@tabletop/common'
import { describe, expect, it } from 'vitest'
import { RideTheRailsInfo } from './info.js'
import { GAME_VERSION } from './version.js'

describe('RideTheRailsInfo', () => {
    it('seats three to five players and defaults to four (R-1.2-H1)', () => {
        expect(RideTheRailsInfo.metadata).toMatchObject({
            minPlayers: 3,
            maxPlayers: 5,
            defaultPlayerCount: 4
        })
    })

    it('offers no creation options (R-8-H1)', () => {
        expect(RideTheRailsInfo.configurator).toBeUndefined()
    })

    it('is a beta title named Ride the Rails', () => {
        expect(RideTheRailsInfo.metadata).toMatchObject({
            name: 'Ride the Rails',
            beta: true,
            visibility: GameVisibility.Beta
        })
    })

    it('reports the generated game version', () => {
        expect(RideTheRailsInfo.metadata.version).toBe(GAME_VERSION)
    })
})
