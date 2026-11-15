import { describe, expect, it } from 'vitest'
import { minorAcquisitionDetails, privateAcquisitionDetails, settlementDetails } from './history.js'

const names = {
    companyName: (id: string) => id,
    playerName: (id: string) => `Player ${id}`,
    place: (locationId: string) => `at ${locationId}`
}
const player = (playerId: string) => ({ kind: 'player' as const, playerId })
const company = (companyId: string) => ({ kind: 'company' as const, companyId })

describe('1822 history', () => {
    it('tells what a settled round did beside selling the lots (§3.3.5, §4.10)', () => {
        expect(
            settlementDetails(
                {
                    minors: [
                        {
                            companyId: 'M5',
                            playerId: 'a',
                            marketSpaceId: 'x',
                            parPrice: 50,
                            treasury: 100
                        }
                    ],
                    removedTrains: [{ trainId: 't1', definitionId: 'L' }],
                    removedMinor: { companyId: 'M3', train: { trainId: 't2', definitionId: 'L' } },
                    toPhaseId: '2',
                    loanInterest: [{ playerId: 'b', interest: 25 }]
                },
                names
            )
        ).toEqual([
            'M5 starts at £50 with £100',
            'M3 had no bid in the first box and is removed, and one L-train with it',
            'A train was removed for the minor companies no one bid on',
            'Phase 2 begins',
            'Player b’s loan grows by £25'
        ])
        expect(
            settlementDetails(
                { minors: [], removedTrains: [], loanInterest: [], nothingSold: true },
                names
            )
        ).toEqual(['Nothing was sold, so the game ends'])
    })

    it('tells what a major took with a minor from its director (§5.18)', () => {
        expect(
            minorAcquisitionDetails(
                { companyId: 'LNWR', token: 'place' },
                {
                    source: 'director',
                    playerId: 'a',
                    payments: [
                        { from: company('LNWR'), to: player('a'), amount: 20 },
                        { from: company('M5'), to: company('LNWR'), amount: 35 }
                    ],
                    certificateIds: ['LNWR:3'],
                    cash: 35,
                    trains: [{ trainId: 't1', definitionId: '2' }],
                    discarded: [{ trainId: 't3', definitionId: 'L' }],
                    removedTrainIds: [],
                    privateIds: ['P8'],
                    station: { stationId: 's', locationId: 'J15', nodeId: 'city', slot: 0 }
                },
                names
            )
        ).toEqual([
            'Player a took 1 share of LNWR',
            'LNWR paid Player a £20',
            'Treasury of £35',
            'Took its 2-train',
            'Discarded L-train',
            'Took P8',
            'Exchange token placed in at J15'
        ])
    })

    it('tells what a company took with a private company (Table 3)', () => {
        expect(privateAcquisitionDetails('token', { playerId: 'a', closed: true }, names)).toEqual([
            'From Player a',
            'Took its terrain token',
            'The private company closed'
        ])
    })
})
