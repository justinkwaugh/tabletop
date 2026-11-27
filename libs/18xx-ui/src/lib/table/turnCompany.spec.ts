import { expect, it } from 'vitest'
import { ActionSource, type GameAction } from '@tabletop/common'
import type { EighteenXXState } from '@tabletop/18xx'
import { historyStateFixture } from './history.fixture.js'
import { turnCompanyId } from './turnCompany.js'

function operatingState(machineState: string): EighteenXXState {
    return {
        ...historyStateFixture(),
        machineState,
        companies: [
            { id: 'MS', kind: 'minor' },
            { id: 'B&O', kind: 'major' },
            { id: 'SC', kind: 'private' }
        ],
        operatingSet: {
            number: 1,
            roundNumber: 1,
            roundCount: 2,
            companyOrder: ['MS', 'B&O'],
            completedCompanyIds: [],
            privateIncomePaid: true,
            completed: false
        }
    }
}

const assignment: GameAction = {
    id: 'assign',
    gameId: 'game',
    type: 'AssignSteamboat',
    source: ActionSource.User
}
const steamboat = {
    turnPrivateId: (state: EighteenXXState, viewedAction?: GameAction) =>
        state.machineState === 'AssigningSteamboat' || viewedAction?.type === 'AssignSteamboat'
            ? 'SC'
            : undefined
}

it('names the company operating or next to operate', () => {
    expect(turnCompanyId(operatingState('LayingTrack'), {})).toBe('MS')
    expect(turnCompanyId(operatingState('LayingTrack'), steamboat)).toBe('MS')
})

it('names the private the title waits on in place of the next company to operate', () => {
    expect(turnCompanyId(operatingState('AssigningSteamboat'), steamboat)).toBe('SC')
})

it('names the private whose owner made the action a history step shows', () => {
    expect(turnCompanyId(operatingState('OperatingSet'), steamboat, assignment)).toBe('SC')
})

it('names no closed company', () => {
    const state = operatingState('LayingTrack')
    state.companies = state.companies.map((company) => ({ ...company, closed: true }))
    expect(turnCompanyId(state, {})).toBeUndefined()
})
