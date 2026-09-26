import * as Type from 'typebox'
import { describe, expect, it } from 'vitest'
import {
    ConfigOptionType,
    defaultGameConfig,
    normalizeGameConfig,
    type GameConfigurator,
    type GameConfigOptions
} from '@tabletop/common'
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

it('normalizes legacy options before filtering game cards and displaying tournament rules', () => {
    const configurator: GameConfigurator = {
        schema: Type.Object({ privateMoney: Type.Optional(Type.Boolean()) }),
        options: [
            {
                id: 'privateMoney',
                name: 'Private money',
                description: '',
                type: ConfigOptionType.Boolean,
                default: false
            }
        ],
        normalizeConfig(config) {
            return { privateMoney: config.privateMoney ?? config.publicMoney === false }
        },
        validateConfig() {},
        updateConfig(config, update) {
            config[update.id] = update.value
        }
    }
    expect(gameCardOptions({ publicMoney: false }, configurator)).toEqual([
        { name: 'Private money', value: 'Yes' }
    ])
    expect(gameCardOptions({ publicMoney: true }, configurator)).toEqual([])
    expect(configuredGameOptions({ publicMoney: false }, configurator)).toEqual([
        { name: 'Private money', value: 'Yes' }
    ])
})

it('uses runtime null semantics for summaries and preserves older configurator behavior', () => {
    const options: GameConfigOptions = [
        {
            id: 'enabled',
            type: ConfigOptionType.Boolean,
            name: 'Enabled',
            description: '',
            default: true
        }
    ]
    const legacyConfigurator: GameConfigurator = {
        schema: Type.Object({}),
        options,
        validateConfig() {},
        updateConfig() {}
    }
    const configurator: GameConfigurator = {
        ...legacyConfigurator,
        normalizeConfig(config) {
            const { legacyMode, ...current } = config
            return { ...current, enabled: current.enabled ?? legacyMode === null }
        }
    }
    const stored = { legacyMode: null }
    expect(normalizeGameConfig(stored, configurator)).toEqual({ enabled: false })
    expect(configuredGameOptions(stored, configurator)).toEqual([{ name: 'Enabled', value: 'No' }])
    expect(gameCardOptions(stored, configurator)).toEqual([{ name: 'Enabled', value: 'No' }])
    expect(configuredGameOptions({ enabled: null }, legacyConfigurator)).toEqual(
        configuredGameOptions({ enabled: null }, options)
    )
    expect(stored).toEqual({ legacyMode: null })
})
