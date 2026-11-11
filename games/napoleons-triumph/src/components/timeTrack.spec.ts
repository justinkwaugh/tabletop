import { describe, expect, it } from 'vitest'
import { ROUNDS, Scenario, hourLabel, roundLabel } from './timeTrack.js'

describe('the labels of the time track', () => {
    const [seven, , , , , noon, one] = ROUNDS[Scenario.December2]
    const night = ROUNDS[Scenario.December1][10]

    it('name the hour with its minutes, or without', () => {
        expect([seven, noon, one].map((round) => hourLabel(round))).toEqual([
            '7:00AM',
            '12:00PM',
            '1:00PM'
        ])
        expect([seven, noon, one].map((round) => hourLabel(round, { minutes: false }))).toEqual([
            '7AM',
            '12PM',
            '1PM'
        ])
        expect(hourLabel(night, { minutes: false })).toBe('Night')
    })

    it('name the day before the hour when asked', () => {
        expect(roundLabel(one, true)).toBe('2 December · 1:00PM')
        expect(roundLabel(night, true)).toBe('1 December · Night')
    })
})
