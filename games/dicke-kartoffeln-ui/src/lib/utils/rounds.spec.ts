import { describe, expect, it } from 'vitest'
import { MachineState } from '@tabletop/dicke-kartoffeln'
import { CompostPileId, compostUseYear, sowingDecided, upcomingRounds } from './rounds.js'

describe('the year track', () => {
    it('shows the round in play and the five after it, into next year', () => {
        const rounds = upcomingRounds(MachineState.SoilReacting, true, 6)
        expect(rounds.map((round) => round.number)).toEqual(['9', '10', '11', '12', '1', '2'])
        expect(rounds.map((round) => round.current)).toEqual([
            true,
            false,
            false,
            false,
            false,
            false
        ])
        expect(rounds.filter((round) => round.nextYear).map((round) => round.number)).toEqual([
            '1',
            '2'
        ])
    })

    it('stops at round 12 in the last year', () => {
        const rounds = upcomingRounds(MachineState.SoilReacting, false, 6)
        expect(rounds.map((round) => round.number)).toEqual(['7', '8', '9', '10', '11', '12'])
        expect(rounds.find((round) => round.current)?.number).toBe('9')
    })
})

describe('the year track width', () => {
    it('shows at most one whole year', () => {
        const rounds = upcomingRounds(MachineState.Harvesting, true, 20)
        expect(rounds.map((round) => round.number)).toEqual([
            '6',
            '7',
            '8',
            '9',
            '10',
            '11',
            '12',
            '1',
            '2',
            '3',
            '4',
            '5'
        ])
    })

    it('narrows to the next few', () => {
        const rounds = upcomingRounds(MachineState.Harvesting, true, 3)
        expect(rounds.map((round) => round.number)).toEqual(['6', '7', '8'])
    })
})

describe('compost timing', () => {
    it('spreads pile 2 this year until round 10, then next year', () => {
        expect(compostUseYear(MachineState.TakingCompost, 2, CompostPileId.Ripe)).toBe(2)
        expect(compostUseYear(MachineState.SpreadingCompost, 2, CompostPileId.Ripe)).toBe(2)
        expect(compostUseYear(MachineState.EndingYear, 2, CompostPileId.Ripe)).toBe(3)
    })

    it('spreads pile 1 next year until it rots, then the year after', () => {
        expect(compostUseYear(MachineState.TakingCompost, 2, CompostPileId.Fresh)).toBe(3)
        expect(compostUseYear(MachineState.EndingYear, 2, CompostPileId.Fresh)).toBe(4)
    })
})

describe('sowing', () => {
    it('is decided once the sowing round has been revealed', () => {
        expect(sowingDecided(MachineState.Cultivating)).toBe(false)
        expect(sowingDecided(MachineState.Sowing)).toBe(false)
        expect(sowingDecided(MachineState.Fertilizing)).toBe(true)
        expect(sowingDecided(MachineState.EndingYear)).toBe(true)
    })
})
