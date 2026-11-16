import { describe, expect, it } from 'vitest'
import { RideTheRailsInfo } from './info.js'
import { GAME_VERSION } from './version.js'

describe('RideTheRailsInfo', () => {
    it('seats three to five players and defaults to four (R-1.2)', () => {
        expect(RideTheRailsInfo.metadata).toMatchObject({
            minPlayers: 3,
            maxPlayers: 5,
            defaultPlayerCount: 4
        })
    })

    it('offers no creation options (R-8)', () => {
        expect(RideTheRailsInfo.configurator).toBeUndefined()
    })

    it('is a public title named Ride the Rails', () => {
        expect(RideTheRailsInfo.metadata).toMatchObject({ name: 'Ride the Rails', beta: false })
        expect(RideTheRailsInfo.metadata.visibility).toBeUndefined()
    })

    it('reports the generated game version', () => {
        expect(RideTheRailsInfo.metadata.version).toBe(GAME_VERSION)
    })
})
