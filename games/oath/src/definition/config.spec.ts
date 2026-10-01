import { describe, expect, it } from 'vitest'
import { defaultGameConfig, isListConfigOption } from '@tabletop/common'
import { OathType } from '../model/oathEnums.js'
import { SetupVariant } from '../model/oathEnums.js'
import { OathGameConfigOptions, normalizeOathConfig } from './config.js'
import { readOathGameConfig } from './initializer.js'
import { OathConfigurator } from './configurator.js'
import { required } from '../testing/required.js'
import { engine } from '../testing/engine.js'
import { waitingGame } from '../testing/game.js'
import { OathRuntime } from './runtime.js'

describe('OathGameConfigOptions — the lobby configurator', () => {
    it('defaults to the random deck and the Oath of Supremacy', () => {
        expect(defaultGameConfig(OathGameConfigOptions)).toEqual({
            setupVariant: SetupVariant.Randomized,
            oathType: OathType.Supremacy
        })
    })

    it('offers the random deck only', () => {
        const deckOption = required(OathGameConfigOptions.find((option) => option.id === 'setupVariant'), 'the deck option')
        expect(isListConfigOption(deckOption)).toBe(true)
        if (isListConfigOption(deckOption)) {
            expect(deckOption.options.map((option) => option.value)).toEqual([SetupVariant.Randomized])
        }
    })

    it('offers every Oath', () => {
        const oathOption = required(OathGameConfigOptions.find((option) => option.id === 'oathType'), 'the Oath option')
        expect(isListConfigOption(oathOption)).toBe(true)
        if (isListConfigOption(oathOption)) {
            expect(new Set(oathOption.options.map((option) => option.value))).toEqual(
                new Set(Object.values(OathType))
            )
        }
    })

    it('the configurator validates a config built from its own defaults', () => {
        const configurator = new OathConfigurator()
        const config = defaultGameConfig(OathGameConfigOptions)
        expect(() => configurator.validateConfig(config)).not.toThrow()
        expect(readOathGameConfig(config)).toEqual(config)
    })

    const casesByOptionId = OathGameConfigOptions.flatMap((option) =>
        isListConfigOption(option)
            ? option.options.map((choice) => ({ id: option.id, name: choice.name, value: choice.value }))
            : []
    )

    it.each(casesByOptionId)('the configurator validates $id = $name', ({ id, value }) => {
        const configurator = new OathConfigurator()
        const config = defaultGameConfig(OathGameConfigOptions)
        configurator.updateConfig(config, { id, value })
        expect(() => configurator.validateConfig(config)).not.toThrow()
    })
})

/** DESIGN, configuration compatibility — a stored setup still waiting to start may carry the retired fixed deck. */
describe('normalizeOathConfig — stored configuration', () => {
    it('a stored setup naming the retired fixed deck starts with a random one, its Oath kept', () => {
        expect(normalizeOathConfig({ setupVariant: 'curated', oathType: OathType.Protection })).toEqual({
            setupVariant: SetupVariant.Randomized,
            oathType: OathType.Protection
        })
    })

    it('leaves a current configuration as it is, and is idempotent', () => {
        const config = { setupVariant: SetupVariant.Randomized, oathType: OathType.Devotion }
        expect(normalizeOathConfig(config)).toEqual(config)
        expect(normalizeOathConfig(normalizeOathConfig({ setupVariant: 'curated' }))).toEqual({
            setupVariant: SetupVariant.Randomized
        })
        expect(normalizeOathConfig({})).toEqual({})
    })

    it('rejects a value no version ever stored, rather than defaulting it', () => {
        expect(() => normalizeOathConfig({ setupVariant: 'shuffled' })).toThrow(/Not an Oath configuration/)
        expect(() => normalizeOathConfig({ oathType: 'conquest' })).toThrow(/Not an Oath configuration/)
    })

    it('starting a waiting game whose stored setup names it deals a random deck, through the runtime', () => {
        const { initialState } = engine.startGame(waitingGame(3, { setupVariant: 'curated' }), {
            masterSeed: '0123456789abcdef0123456789abcdef'
        })
        expect(initialState.setupVariant).toBe(SetupVariant.Randomized)
        expect(OathRuntime.configuration?.normalizeConfig({ setupVariant: 'curated' })).toEqual({
            setupVariant: SetupVariant.Randomized
        })
    })

    it('is the configurator’s hook', () => {
        expect(new OathConfigurator().normalizeConfig({ setupVariant: 'curated' })).toEqual({
            setupVariant: SetupVariant.Randomized
        })
    })
})
