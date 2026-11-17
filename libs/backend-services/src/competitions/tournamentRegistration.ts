import type { Tournament } from '@tabletop/common'
import { nanoid } from 'nanoid'
import { touchRevision } from './competitionAccess.js'

export function updateTournamentRegistration(tournament: Tournament, now: number): boolean {
    if (tournament.status !== 'open') return false
    const policy = tournament.rules.registration
    if (policy.kind === 'assigned') return false
    if (policy.kind === 'whenFull') {
        if (tournament.entrants.length < policy.capacity) {
            delete tournament.schedulingError
            delete tournament.startsAt
            delete tournament.startId
            delete tournament.nextTaskAt
            return false
        }
        if (tournament.startsAt === undefined) {
            tournament.startsAt = now + 60_000
            tournament.startId = nanoid()
            tournament.nextTaskAt = tournament.startsAt
            return false
        }
        if (now < tournament.startsAt) return false
    } else if (now < policy.closesAt) {
        tournament.nextTaskAt = policy.closesAt
        return false
    }
    if (policy.kind === 'deadline' && tournament.entrants.length < policy.minimumEntrants) {
        delete tournament.schedulingError
        delete tournament.startsAt
        delete tournament.startId
        tournament.status = 'cancelled'
        tournament.cancelledAt = now
        tournament.cancellationReason = 'undersubscribed'
        delete tournament.nextTaskAt
        touchRevision(tournament, now)
    } else {
        lockTournamentRegistration(tournament, now)
    }
    return true
}

export function lockTournamentRegistration(tournament: Tournament, now: number) {
    delete tournament.startsAt
    delete tournament.startId
    tournament.status = 'locked'
    tournament.lockedAt = now
    tournament.nextTaskAt = now
    tournament.stages = [
        {
            id: tournament.format.stages[0].id,
            status: 'awaitingSchedule',
            rosterRevision: tournament.revision + 1,
            createdAt: now
        }
    ]
    touchRevision(tournament, now)
}
