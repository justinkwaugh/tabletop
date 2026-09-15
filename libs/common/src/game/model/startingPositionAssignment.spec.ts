import { describe, expect, it } from 'vitest'
import { validateStartingPositionAssignment } from './startingPositionAssignment.js'

describe('starting position assignment', () => {
    it('validates a complete identity permutation, including the source roster', () => {
        expect(() =>
            validateStartingPositionAssignment(['p1', 'p2'], { playerIds: ['p2', 'p1'] })
        ).not.toThrow()
        expect(() =>
            validateStartingPositionAssignment(['p1', 'p1'], { playerIds: ['p1', 'p2'] })
        ).toThrow('every player')
        expect(() =>
            validateStartingPositionAssignment(['p1', 'p2'], { playerIds: ['p1', 'outsider'] })
        ).toThrow('every player')
    })
})
