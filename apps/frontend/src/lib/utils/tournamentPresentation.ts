import type { Tournament } from '@tabletop/common'

export function tournamentFormatText(format: Tournament['format']): string {
    return format.kind === 'mini' ? 'Mini tournament' : 'Multi-stage tournament'
}

export function tournamentRegistrationOpen(tournament: Tournament, now = Date.now()): boolean {
    return (
        tournament.status === 'open' &&
        (tournament.startsAt === undefined || now < tournament.startsAt) &&
        (tournament.rules.registration.kind !== 'deadline' ||
            now < tournament.rules.registration.closesAt)
    )
}

export function tournamentRegistrationText(tournament: Tournament, now = Date.now()): string {
    if (tournament.startsAt !== undefined) return 'Registration closes when the tournament starts.'
    const policy = tournament.rules.registration
    return policy.kind === 'whenFull'
        ? `Starts when ${policy.capacity} players have joined`
        : `Registration ${now < policy.closesAt ? 'closes' : 'closed'} ${new Date(
              policy.closesAt
          ).toLocaleString(undefined, {
              day: 'numeric',
              month: 'short',
              hour: 'numeric'
          })}. At least ${policy.minimumEntrants} players required${policy.capacity ? `; up to ${policy.capacity}` : ''}.`
}

export function tournamentStatusColor(tournament: Tournament, now = Date.now()): string {
    return tournamentRegistrationOpen(tournament, now)
        ? 'text-green-700 dark:text-green-400'
        : 'text-blue-700 dark:text-blue-300'
}

export function tournamentSummaryText(tournament: Tournament, now = Date.now()): string {
    if (tournament.status === 'finished') {
        const date = tournament.finishedAt
            ? new Date(tournament.finishedAt).toLocaleDateString(undefined, {
                  day: 'numeric',
                  month: 'short'
              })
            : ''
        return date ? `Completed ${date}` : 'Completed'
    }
    if (tournament.status === 'inProgress') {
        return `${tournament.stages[0]?.dispatch?.finished.length ?? 0} games finished`
    }
    if (tournament.status === 'locked') return 'Registration closed'
    return tournamentRegistrationText(tournament, now)
}

export function tournamentStatusText(tournament: Tournament, now = Date.now()): string {
    if (tournament.paused) return 'Scheduling paused'
    if (tournament.schedulingError && ['open', 'locked'].includes(tournament.status))
        return 'Start delayed'
    if (tournament.startsAt !== undefined) {
        const seconds = Math.max(0, Math.ceil((tournament.startsAt - now) / 1000))
        return seconds > 0 ? `Starting in ${seconds}s` : 'Starting…'
    }
    switch (tournament.status) {
        case 'draft':
            return 'Draft'
        case 'open':
            return tournamentRegistrationOpen(tournament, now)
                ? 'Registration open'
                : 'Registration closed'
        case 'finished':
            return 'Finished'
        case 'inProgress':
            return 'In progress'
        case 'locked':
            return tournament.nextTaskAt !== undefined ? 'Starting…' : 'Roster locked'
        case 'cancelled':
            return tournament.cancellationReason === 'undersubscribed'
                ? 'Cancelled — minimum roster not met'
                : 'Cancelled'
    }
}
