import { describe, expect, it } from 'vitest'
import { ConfigOptionType, defaultGameConfig, type GameConfigOptions } from '@tabletop/common'
import { configuredGameOptions, gameCardOptions } from './gameOptions'

describe('configured game options', () => {
    const options: GameConfigOptions = [
        {
            id: 'expert',
            name: 'Expert rules',
            description: '',
            type: ConfigOptionType.Boolean,
            default: false
        },
        {
            id: 'map',
            name: 'Map',
            description: '',
            type: ConfigOptionType.List,
            default: 'base',
            options: [
                { name: 'Original map', value: 'base' },
                { name: 'Island map', value: 'island' }
            ]
        }
    ]
    it('displays default false and named choices alongside overrides', () => {
        expect(configuredGameOptions(defaultGameConfig(options), options)).toEqual([
            { name: 'Expert rules', value: 'No' },
            { name: 'Map', value: 'Original map' }
        ])
        expect(configuredGameOptions({ expert: true, map: 'island' }, options)).toEqual([
            { name: 'Expert rules', value: 'Yes' },
            { name: 'Map', value: 'Island map' }
        ])
    })
    it('retains persisted values while the game library is unavailable', () => {
        expect(configuredGameOptions({ expert: false, rounds: 0, label: null }, [])).toEqual([
            { name: 'expert', value: 'No' },
            { name: 'rounds', value: '0' },
            { name: 'label', value: 'None' }
        ])
    })
    it('hides card defaults and formats non-default choices', () => {
        expect(gameCardOptions(defaultGameConfig(options), options)).toEqual([])
        expect(gameCardOptions({ expert: true, map: 'island' }, options)).toEqual([
            { name: 'Expert rules', value: 'Yes' },
            { name: 'Map', value: 'Island map' }
        ])
        expect(gameCardOptions({ expert: false, map: 'island', unknown: true }, options)).toEqual([
            { name: 'Map', value: 'Island map' }
        ])
    })
    it('honors always-show options and optional input defaults', () => {
        const definitions: GameConfigOptions = [
            { ...options[0], alwaysShow: true },
            { id: 'label', name: 'Label', description: '', type: ConfigOptionType.StringInput },
            {
                id: 'rounds',
                name: 'Rounds',
                description: '',
                type: ConfigOptionType.NumberInput,
                default: 5
            }
        ]
        expect(gameCardOptions({ expert: false, label: null, rounds: 0 }, definitions)).toEqual([
            { name: 'Expert rules', value: 'No' },
            { name: 'Rounds', value: '0' }
        ])
        expect(gameCardOptions({ expert: true }, [])).toEqual([])
    })
})
