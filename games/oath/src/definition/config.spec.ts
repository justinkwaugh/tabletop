import { describe, expect, it } from 'vitest'
import { defaultGameConfig, isListConfigOption } from '@tabletop/common'
import { OathType } from '../model/oathEnums.js'
import { SetupVariant } from '../data/worldDeck.js'
import { OathGameConfigOptions, readOathGameConfig } from './config.js'
import { OathConfigurator } from './configurator.js'
import { required } from '../testing/required.js'

describe('OathGameConfigOptions — the lobby configurator', () => {
    it('defaults to the random deck and the Oath of Supremacy', () => {
        expect(defaultGameConfig(OathGameConfigOptions)).toEqual({
            setupVariant: SetupVariant.Randomized,
            oathType: OathType.Supremacy
        })
    })

    it('offers the two deck variants', () => {
        const deckOption = required(OathGameConfigOptions.find((option) => option.id === 'setupVariant'), 'the deck option')
        expect(isListConfigOption(deckOption)).toBe(true)
        if (isListConfigOption(deckOption)) {
            expect(deckOption.options.map((option) => option.value)).toEqual([
                SetupVariant.Randomized,
                SetupVariant.Curated
            ])
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
