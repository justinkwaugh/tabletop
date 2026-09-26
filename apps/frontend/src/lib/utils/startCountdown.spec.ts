import { describe, expect, it } from 'vitest'
import { startCountdownText } from './startCountdown'

describe('start countdown', () => {
    it('counts whole seconds up to the start and then shows the start is pending', () => {
        expect(startCountdownText(61_000, 1_000)).toBe('Starting in 60s')
        expect(startCountdownText(61_000, 60_500)).toBe('Starting in 1s')
        expect(startCountdownText(61_000, 61_000)).toBe('Starting…')
        expect(startCountdownText(61_000, 70_000)).toBe('Starting…')
    })
})
