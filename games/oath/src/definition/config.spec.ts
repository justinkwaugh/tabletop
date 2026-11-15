import { describe, expect, it } from 'vitest'
import { defaultGameConfig, type GameConfig } from '@tabletop/common'
import { OathType } from '../model/oathEnums.js'
import { SetupVariant } from '../model/oathEnums.js'
import { OathGameConfigOptions, normalizeOathConfig } from './config.js'
import { readOathGameConfig } from './initializer.js'
import { OathConfigurator } from './configurator.js'
import { engine } from '../testing/engine.js'
import { waitingGame } from '../testing/game.js'
import { OathRuntime } from './runtime.js'
import { OathGameStateValidator } from '../model/gameState.js'
import { testPlayer, testState } from '../testing/fixture.js'

const SEED = '0123456789abcdef0123456789abcdef'

describe('OathGameConfigOptions — Oath shows no game options', () => {
    it('offers none: a new game’s config is empty', () => {
        expect(OathGameConfigOptions).toEqual([])
        expect(defaultGameConfig(OathGameConfigOptions)).toEqual({})
    })

    it('the configurator validates a new game’s empty config', () => {
        const configurator = new OathConfigurator()
        const config = defaultGameConfig(OathGameConfigOptions)
        expect(() => configurator.validateConfig(config)).not.toThrow()
        expect(readOathGameConfig(config)).toEqual({})
    })

    it('R-1.13 — a first game set up without options is the Oath of Supremacy on a random deck, byte for byte as when the form named them', () => {
        // The state's own id is drawn fresh at every start; everything else is set up from the seed.
        const start = (config: GameConfig) => {
            const { initialState } = engine.startGame(
                { ...waitingGame(3, config), createdAt: new Date('2026-10-29T12:00:00Z') },
                { masterSeed: SEED }
            )
            return JSON.stringify({ ...initialState, id: 'state' })
        }
        const empty = start({})
        expect(start({ oathType: OathType.Supremacy })).toBe(empty)
        expect(start({ setupVariant: SetupVariant.Randomized })).toBe(empty)
        expect(start({ setupVariant: SetupVariant.Randomized, oathType: OathType.Supremacy })).toBe(
            empty
        )
        const state = JSON.parse(empty) as { oathType: OathType; setupVariant: SetupVariant }
        expect(state.oathType).toBe(OathType.Supremacy)
        expect(state.setupVariant).toBe(SetupVariant.Randomized)
    })
})

/** DESIGN, configuration compatibility — a stored setup still waiting to start may carry the retired fixed deck. */
describe('normalizeOathConfig — stored configuration', () => {
    it('a stored setup naming the retired fixed deck starts with a random one, its Oath kept', () => {
        expect(
            normalizeOathConfig({ setupVariant: 'curated', oathType: OathType.Protection })
        ).toEqual({
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

    it.each(Object.values(OathType))(
        'a stored config naming %s still normalizes, and its game starts under that Oath',
        (oathType) => {
            const stored = { setupVariant: SetupVariant.Randomized, oathType }
            expect(normalizeOathConfig(stored)).toEqual(stored)
            expect(normalizeOathConfig({ oathType })).toEqual({ oathType })
            const { initialState } = engine.startGame(waitingGame(3, stored), {
                masterSeed: SEED
            })
            expect(initialState.oathType).toBe(oathType)
        }
    )

    it('a stored config naming either deck still normalizes', () => {
        expect(normalizeOathConfig({ setupVariant: SetupVariant.Randomized })).toEqual({
            setupVariant: SetupVariant.Randomized
        })
        expect(normalizeOathConfig({ setupVariant: SetupVariant.Curated })).toEqual({
            setupVariant: SetupVariant.Randomized
        })
    })

    it('rejects a value no version ever stored, rather than defaulting it', () => {
        expect(() => normalizeOathConfig({ setupVariant: 'shuffled' })).toThrow(
            /Not an Oath configuration/
        )
        expect(() => normalizeOathConfig({ oathType: 'conquest' })).toThrow(
            /Not an Oath configuration/
        )
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

/** DESIGN, stored-game compatibility — a game started under 0.1.0 with the fixed deck still loads. */
describe('a stored state naming the retired fixed deck', () => {
    it('validates as canonical state and hydrates unchanged', () => {
        const state = testState([testPlayer({ playerId: 'p1' }), testPlayer({ playerId: 'p2' })], {
            setupVariant: SetupVariant.Curated
        }).dehydrate()
        expect(OathGameStateValidator.Check(state)).toBe(true)
        expect(OathRuntime.hydrator.hydrateState(state).dehydrate()).toEqual(state)
    })
})
