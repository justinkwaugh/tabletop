import { describe, expect, it } from 'vitest'
import type { Tournament } from '@tabletop/common'
import {
    tournamentStatusText,
    tournamentRegistrationOpen,
    tournamentRegistrationText,
    tournamentStatusColor
} from './tournamentPresentation'

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
                    schedulingError: 'Setup failed'
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

describe('registration cutoff', () => {
    const dated: Tournament = {
        ...locked,
        status: 'open',
        rules: {
            ...locked.rules,
            registration: { kind: 'deadline', minimumEntrants: 7, closesAt: 61000 }
        }
    }
    it('closes at the deadline while the stored event still says open', () => {
        expect(tournamentRegistrationOpen(dated, 60999)).toBe(true)
        expect(tournamentStatusText(dated, 60999)).toBe('Registration open')
        expect(tournamentStatusColor(dated, 60999)).toContain('green')
        for (const now of [61000, 62000]) {
            expect(tournamentRegistrationOpen(dated, now)).toBe(false)
            expect(tournamentStatusText(dated, now)).toBe('Registration closed')
            expect(tournamentRegistrationText(dated, now)).toContain('Registration closed')
            expect(tournamentStatusColor(dated, now)).not.toContain('green')
        }
    })
    it('allows withdrawal during the full-roster countdown and closes at its end', () => {
        const countdown: Tournament = { ...locked, status: 'open', startsAt: 61000 }
        expect(tournamentRegistrationOpen(countdown, 60999)).toBe(true)
        expect(tournamentRegistrationOpen(countdown, 61000)).toBe(false)
        expect(tournamentStatusText(countdown, 61000)).toBe('Starting…')
    })
    it('keeps undated registration open until its countdown and respects closed lifecycle states', () => {
        expect(tournamentRegistrationOpen({ ...locked, status: 'open' }, 62000)).toBe(true)
        expect(tournamentRegistrationOpen(locked, 62000)).toBe(false)
    })
})

it('shows an initial scheduling failure before a stage exists', () => {
    expect(
        tournamentStatusText(
            {
                ...locked,
                status: 'open',
                stages: [],
                startsAt: 1000,
                schedulingError: 'Schedule failed'
            },
            1000
        )
    ).toBe('Start delayed')
})

it('keeps the paused label when a failed start is paused by an administrator', () => {
    expect(tournamentStatusText({ ...locked, paused: true, schedulingError: 'Setup failed' })).toBe(
        'Scheduling paused'
    )
})
