import { ConfigOptionType } from '@tabletop/common'
import { describe, expect, it } from 'vitest'
import { MAP_DETAILS, MAP_IDS } from '../data/maps.js'
import { mapFromConfig } from './config.js'
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

    it('offers one creation option, the map, USA by default and always shown (R-8)', () => {
        const configurator = RideTheRailsInfo.configurator
        expect(configurator?.options).toHaveLength(1)
        expect(configurator?.options[0]).toMatchObject({
            id: 'map',
            type: ConfigOptionType.List,
            name: 'Map',
            default: 'map.usa',
            alwaysShow: true
        })
    })

    it('lists every map by name, each with the line that says what it changes (R-8)', () => {
        const option = RideTheRailsInfo.configurator?.options[0]
        expect(option?.type === ConfigOptionType.List ? option.options : []).toEqual(
            MAP_IDS.map((mapId) => ({
                name: MAP_DETAILS[mapId].name,
                value: mapId,
                description: MAP_DETAILS[mapId].description
            }))
        )
        expect(MAP_DETAILS['map.usa']).toEqual({
            name: 'USA',
            description: 'The base game’s map.'
        })
    })

    it('accepts every map, and a game that names none (R-8, R-X.3)', () => {
        const configurator = RideTheRailsInfo.configurator
        for (const mapId of MAP_IDS) {
            expect(() => configurator?.validateConfig({ map: mapId })).not.toThrow()
        }
        expect(() => configurator?.validateConfig({})).not.toThrow()
        expect(() => configurator?.validateConfig({ map: 'map.mars' })).toThrow()
    })

    it('plays the USA in a game that names no map, as every game stored before the option (R-8, R-X.3)', () => {
        expect(mapFromConfig({})).toBe('map.usa')
        for (const mapId of MAP_IDS) {
            expect(mapFromConfig({ map: mapId })).toBe(mapId)
        }
        expect(() => mapFromConfig({ map: 'map.mars' })).toThrow(/map\.mars/)
    })

    it('is a public title named Ride the Rails', () => {
        expect(RideTheRailsInfo.metadata).toMatchObject({ name: 'Ride the Rails', beta: false })
        expect(RideTheRailsInfo.metadata.visibility).toBeUndefined()
    })

    it('reports the generated game version', () => {
        expect(RideTheRailsInfo.metadata.version).toBe(GAME_VERSION)
    })
})
