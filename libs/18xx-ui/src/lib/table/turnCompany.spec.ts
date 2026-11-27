import { expect, it } from 'vitest'
import type { EighteenXXState } from '@tabletop/18xx'
import { turnCompanyId } from './turnCompany.js'

function state(machineState: string): EighteenXXState {
    return {
        machineState,
        companies: [
            { id: 'MS', closed: false },
            { id: 'B&O', closed: false }
        ],
        operatingSet: {
            number: 1,
            roundNumber: 1,
            roundCount: 2,
            companyOrder: ['MS', 'B&O'],
            completedCompanyIds: [],
            completed: false
        }
    } as unknown as EighteenXXState
}

it('names the next company to operate', () => {
    expect(turnCompanyId(state('LayingTrack'), {})).toBe('MS')
})

it('names the private the title waits on in place of the next company to operate', () => {
    const presentation = {
        turnPrivate: (current: EighteenXXState) =>
            current.machineState === 'AssigningSteamboat' ? 'SC' : undefined
    }
    expect(turnCompanyId(state('AssigningSteamboat'), presentation)).toBe('SC')
    expect(turnCompanyId(state('LayingTrack'), presentation)).toBe('MS')
})
