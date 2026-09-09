import { describe, expect, it } from 'vitest'
import type { Tournament } from '@tabletop/common'
import { tournamentStatusText } from './tournamentPresentation'

const locked: Tournament = {
    id: 'old-preview',
    name: 'Mini',
    description: '',
    organizerId: 'admin',
    status: 'locked',
    revision: 1,
    createdAt: 1,
    updatedAt: 1,
    entrants: [],
    stages: [],
    format: { kind: 'mini', stages: [{ id: 'main', name: 'Main', gamesPerEntrant: 4 }] },
    rules: {
        titleId: 'sol',
        tableSize: 4,
        concurrency: 4,
        gameConfig: {},
        scoring: 'splitWinsV1',
        registration: { kind: 'whenFull', capacity: 7 }
    }
}

describe('tournament status labels', () => {
    it('distinguishes a legacy locked roster from a pending automatic start', () => {
        expect(tournamentStatusText(locked, 1000)).toBe('Roster locked')
        expect(tournamentStatusText({ ...locked, nextTaskAt: 1000 }, 1000)).toBe('Starting…')
    })
    it('shows a failed start as delayed instead of claiming it is starting', () => {
        expect(
            tournamentStatusText(
                {
                    ...locked,
                    nextTaskAt: 30000,
                    stages: [
                        {
                            id: 'main',
                            status: 'scheduled',
                            rosterRevision: 1,
                            createdAt: 1,
                            dispatch: {
                                reserved: [],
                                active: [],
                                finished: [],
                                error: 'Setup failed'
                            }
                        }
                    ]
                },
                1000
            )
        ).toBe('Start delayed')
    })
    it('keeps the live countdown and the transition to running', () => {
        const pending: Tournament = {
            ...locked,
            status: 'open',
            startsAt: 61000,
            nextTaskAt: 61000
        }
        expect(tournamentStatusText(pending, 1000)).toBe('Starting in 60s')
        expect(tournamentStatusText(pending, 61000)).toBe('Starting…')
        expect(tournamentStatusText({ ...locked, status: 'inProgress' }, 61000)).toBe('In progress')
    })
})
