import { describe, expect, expectTypeOf, it } from 'vitest'
import {
    defaultGameConfig,
    normalizeGame,
    normalizeGameConfig,
    type GameConfig
} from '@tabletop/common'
import { LowenherzConfigurator } from './configurator.js'
import { normalizeLowenherzConfig, type LowenherzGameConfig } from './config.js'

const configurator = new LowenherzConfigurator()
const defaults = { privateMoney: false, standardSetup: false, allowZeroDucatOffers: false }

describe('Lowenherz configuration compatibility', () => {
    it('returns the canonical shape from legacy input in both values and types', () => {
        const config = normalizeGameConfig({ publicMoney: false }, configurator)
        expectTypeOf(config).toEqualTypeOf<LowenherzGameConfig>()
        const game = normalizeGame(
            { id: 'saved-game', config: { publicMoney: false } },
            configurator
        )
        expectTypeOf(game.config).toEqualTypeOf<LowenherzGameConfig>()
        expectTypeOf(game.id).toEqualTypeOf<string>()
        expect(game).toEqual({ id: 'saved-game', config: { ...defaults, privateMoney: true } })
    })

    it('creates ordinary booleans with all variants off', () => {
        expect(defaultGameConfig(configurator.options)).toEqual(defaults)
        expect(normalizeLowenherzConfig({})).toEqual(defaults)
    })

    it.each([true, false])(
        'translates legacy values %s without mutating stored config',
        (value) => {
            const legacy = {
                publicMoney: value,
                playerPlacedCastles: value,
                minimumOneDucat: value
            }
            const normalized = normalizeGameConfig(legacy, configurator)
            expect(normalized).toEqual({
                privateMoney: !value,
                standardSetup: !value,
                allowZeroDucatOffers: !value
            })
            expect(normalizeGameConfig(normalized, configurator)).toEqual(normalized)
            expect(legacy).toEqual({
                publicMoney: value,
                playerPlacedCastles: value,
                minimumOneDucat: value
            })
        }
    )

    it('preserves legacy variants when an unchanged edit or tournament draft merges defaults', () => {
        const legacy = { publicMoney: false, playerPlacedCastles: false, minimumOneDucat: false }
        const edited = normalizeGameConfig(legacy, configurator)
        const saved = normalizeGameConfig({ ...defaultGameConfig(configurator.options), ...edited })
        expect(saved).toEqual({
            privateMoney: true,
            standardSetup: true,
            allowZeroDucatOffers: true
        })
        configurator.updateConfig(edited, { id: 'privateMoney', value: false })
        expect(normalizeGameConfig(edited, configurator).privateMoney).toBe(false)
    })

    it('preserves legacy choices when an older host inserts new defaults', () => {
        expect(
            normalizeLowenherzConfig({
                privateMoney: false,
                publicMoney: false,
                standardSetup: false,
                playerPlacedCastles: false,
                allowZeroDucatOffers: false,
                minimumOneDucat: false,
                futureOption: 42
            })
        ).toEqual({
            privateMoney: true,
            standardSetup: true,
            allowZeroDucatOffers: true,
            futureOption: 42
        })
    })

    it.each<GameConfig>([
        { publicMoney: 'false' },
        { privateMoney: 'true' },
        { playerPlacedCastles: 0 },
        { standardSetup: 1 },
        { minimumOneDucat: 'no' },
        { allowZeroDucatOffers: 'yes' }
    ])('does not normalize invalid input into a valid configuration: %j', (config) => {
        expect(() =>
            configurator.validateConfig(normalizeGameConfig(config, configurator))
        ).toThrow()
    })
})
