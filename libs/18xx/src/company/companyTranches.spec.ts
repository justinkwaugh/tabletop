import { describe, expect, it } from 'vitest'
import { nextCompanyTranche } from './companyState.js'

const tranches = [
    { id: 'initial', name: 'Initial', capacity: 2, companyIds: ['M', 'S'] },
    { id: '1', name: 'Tranche 1', capacity: 1, companyIds: ['A'] },
    { id: '2', name: 'Tranche 2', capacity: 2, companyIds: [] }
]

describe('nextCompanyTranche', () => {
    it('waits for nothing once every company in the full tranches before it is complete', () => {
        expect(nextCompanyTranche(tranches, () => true)).toEqual({
            tranche: tranches[2],
            waitingCompanyIds: []
        })
    })

    it('waits for every incomplete company in the full tranches before it', () => {
        const completed = (companyId: string) => companyId === 'S'
        expect(nextCompanyTranche(tranches, completed)).toEqual({
            tranche: tranches[2],
            waitingCompanyIds: ['M', 'A']
        })
    })

    it('stops at the first tranche with room, whatever follows it', () => {
        const open = [{ ...tranches[0], companyIds: ['M'] }, tranches[1], tranches[2]]
        expect(nextCompanyTranche(open, () => false)).toEqual({
            tranche: open[0],
            waitingCompanyIds: []
        })
    })

    it('has no next tranche once every tranche is full', () => {
        expect(nextCompanyTranche([tranches[0], tranches[1]], () => true)).toBeUndefined()
    })
})
