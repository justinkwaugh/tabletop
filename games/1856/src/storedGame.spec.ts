import { expect } from 'vitest'
import { storedGameTests } from '../../../libs/18xx/test/storedGame.js'
import { Definition } from './definition/gameDefinition.js'

// The harness scenario "loan-step" as the logic stored it before presidents were derived from
// their certificates (2026-11-20).
storedGameTests(
    Definition,
    new URL('../test/fixtures/stored-game.json', import.meta.url),
    (stored, hydrated) => {
        expect(stored.bank).toEqual({ breaksOnShortfall: true })
        expect(hydrated.bankRules?.breaksOnShortfall).toBe(true)
    }
)
