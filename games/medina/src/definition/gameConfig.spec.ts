import { describe, expect, it } from 'vitest'
import { hidesPieceCounts, MedinaConfigurator, playsWithTeaTiles } from './gameConfig.js'

describe('the tea tiles option', () => {
    it('is off unless chosen', () => {
        expect(playsWithTeaTiles(undefined)).toBe(false)
        expect(playsWithTeaTiles({})).toBe(false)
        expect(playsWithTeaTiles({ teaTiles: false })).toBe(false)
        expect(playsWithTeaTiles({ teaTiles: true })).toBe(true)
    })
})

describe('the hidden pieces option', () => {
    it('is off unless chosen', () => {
        expect(hidesPieceCounts(undefined)).toBe(false)
        expect(hidesPieceCounts({})).toBe(false)
        expect(hidesPieceCounts({ hiddenPieces: false })).toBe(false)
        expect(hidesPieceCounts({ hiddenPieces: true })).toBe(true)
    })

    it('is accepted alongside tea tiles, and nothing else is', () => {
        const configurator = new MedinaConfigurator()
        expect(() =>
            configurator.validateConfig({ teaTiles: true, hiddenPieces: true })
        ).not.toThrow()
        expect(() => configurator.validateConfig({ somethingElse: true })).toThrow()
    })
})
