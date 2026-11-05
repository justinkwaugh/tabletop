import { describe, expect, it } from 'vitest'
import { hidesPieceCounts, MedinaConfigurator } from './gameConfig.js'

describe('the hidden pieces option', () => {
    it('is off unless chosen', () => {
        expect(hidesPieceCounts(undefined)).toBe(false)
        expect(hidesPieceCounts({})).toBe(false)
        expect(hidesPieceCounts({ hiddenPieces: false })).toBe(false)
        expect(hidesPieceCounts({ hiddenPieces: true })).toBe(true)
    })

    it('is the only option a game accepts', () => {
        const configurator = new MedinaConfigurator()
        expect(() => configurator.validateConfig({ hiddenPieces: true })).not.toThrow()
        expect(() => configurator.validateConfig({ somethingElse: true })).toThrow()
    })
})
