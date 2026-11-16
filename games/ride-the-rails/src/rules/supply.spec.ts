import { describe, expect, it } from 'vitest'
import { PhaseName } from '../definition/phases.js'
import { buildState } from '../testing/fixtures.js'
import { availableRailroads, hasSupply, supplyOf } from './supply.js'

describe('supply (R-1.1)', () => {
    it('holds all 27 locomotives of a railroad with no shares and no track', () => {
        const state = buildState()
        expect(supplyOf(state, 'railroad.red')).toBe(27)
    })

    it('is 27 minus every player’s shares minus the track on the map (R-1.1)', () => {
        const state = buildState({
            phase: PhaseName.Build,
            shares: {
                p1: { 'railroad.red': 3 },
                p2: { 'railroad.red': 1, 'railroad.blue': 2 },
                p3: { 'railroad.red': 2 }
            },
            track: {
                'hex.usa.6-60': ['railroad.red'],
                'hex.usa.6-58': ['railroad.red', 'railroad.blue'],
                'hex.usa.5-57': ['railroad.red']
            }
        })
        expect(supplyOf(state, 'railroad.red')).toBe(27 - 6 - 3)
        expect(supplyOf(state, 'railroad.blue')).toBe(27 - 2 - 1)
        expect(supplyOf(state, 'railroad.orange')).toBe(27)
    })

    it('is empty once every locomotive is a share or track (R-1.1)', () => {
        const state = buildState({
            phase: PhaseName.Build,
            shares: { p1: { 'railroad.blue': 20 }, p2: { 'railroad.blue': 5 } },
            track: {
                'hex.usa.9-55': ['railroad.blue'],
                'hex.usa.9-53': ['railroad.blue']
            }
        })
        expect(supplyOf(state, 'railroad.blue')).toBe(0)
        expect(hasSupply(state, 'railroad.blue')).toBe(false)
        expect(hasSupply(state, 'railroad.red')).toBe(true)
    })
})

describe('available railroads (R-1.4)', () => {
    it('offers Red and Blue in round 1', () => {
        expect(availableRailroads(buildState({ round: 1 }))).toEqual([
            'railroad.red',
            'railroad.blue'
        ])
    })

    it('adds one railroad in each of rounds 2 to 5, in R-1.4 order', () => {
        expect(availableRailroads(buildState({ round: 2 }))).toEqual([
            'railroad.red',
            'railroad.blue',
            'railroad.orange'
        ])
        expect(availableRailroads(buildState({ round: 3 })).at(-1)).toBe('railroad.yellow')
        expect(availableRailroads(buildState({ round: 4 })).at(-1)).toBe('railroad.purple')
        expect(availableRailroads(buildState({ round: 5 })).at(-1)).toBe('railroad.black')
    })

    it('offers all six in round 6', () => {
        expect(availableRailroads(buildState({ round: 6 }))).toEqual([
            'railroad.red',
            'railroad.blue',
            'railroad.orange',
            'railroad.yellow',
            'railroad.purple',
            'railroad.black'
        ])
    })
})
