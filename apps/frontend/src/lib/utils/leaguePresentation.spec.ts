import { describe, expect, it } from 'vitest'
import type { LeagueListEntry, LeagueSeasonSummary } from '@tabletop/common'
import {
    leagueListStatusText,
    leagueRosterText,
    leagueShowsSignUpDeadline,
    sortLeaguesByName
} from './leaguePresentation'

const now = 1_000_000

function season(overrides: Partial<LeagueSeasonSummary> = {}): LeagueSeasonSummary {
    return {
        number: 2,
        seeding: false,
        status: 'signUp',
        signUpClosesAt: now + 60_000,
        players: 9,
        minimumPlayers: 14,
        ...overrides
    }
}

function entry(
    name: string,
    status: LeagueListEntry['league']['status'],
    current?: LeagueSeasonSummary
): LeagueListEntry {
    return { league: { name, status }, season: current } as LeagueListEntry
}

describe('leagueListStatusText', () => {
    it('labels drafts, leagues without a season, and the current season', () => {
        expect(leagueListStatusText(entry('A', 'draft', season()), now)).toBe('Draft')
        expect(leagueListStatusText(entry('A', 'active'), now)).toBe('Not open yet')
        expect(leagueListStatusText(entry('A', 'active', season()), now)).toBe(
            'Season 2 · Sign-up open'
        )
        expect(
            leagueListStatusText(entry('A', 'active', season({ status: 'finished' })), now)
        ).toBe('Season 2 · Finished')
    })
})

describe('leagueRosterText', () => {
    it('counts toward the minimum during sign-up and players afterwards', () => {
        expect(leagueRosterText(season())).toBe('9 of 14 needed')
        expect(leagueRosterText(season({ players: 14 }))).toBe('14 signed up')
        expect(leagueRosterText(season({ status: 'inProgress', players: 21 }))).toBe('21 players')
    })
})

describe('leagueShowsSignUpDeadline', () => {
    it('counts down only while a season is signing up with no undersubscribed extension', () => {
        expect(leagueShowsSignUpDeadline(season())).toBe(true)
        expect(leagueShowsSignUpDeadline(season({ undersubscribed: true }))).toBe(false)
        expect(leagueShowsSignUpDeadline(season({ status: 'inProgress' }))).toBe(false)
        expect(leagueShowsSignUpDeadline(undefined)).toBe(false)
    })
})

describe('sortLeaguesByName', () => {
    it('orders leagues alphabetically', () => {
        const sorted = sortLeaguesByName([entry('Ladder', 'active'), entry('Coastal', 'active')])
        expect(sorted.map(({ league }) => league.name)).toEqual(['Coastal', 'Ladder'])
    })
})
