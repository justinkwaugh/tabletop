import type { Tournament } from '@tabletop/common'

export function tournamentFormatText(format: Tournament['format']): string {
    return format.kind === 'mini' ? 'Mini tournament' : 'Multi-stage tournament'
}

export function tournamentRegistrationText(tournament: Tournament): string {
    if (tournament.startsAt !== undefined) return 'Registration closes when the tournament starts.'
    const policy = tournament.rules.registration
    return policy.kind === 'whenFull'
        ? `Starts when ${policy.capacity} players have joined`
        : `Registration closes ${new Date(policy.closesAt).toLocaleString(undefined, {
              day: 'numeric',
              month: 'short',
              hour: 'numeric'
          })}. At least ${policy.minimumEntrants} players required${policy.capacity ? `; up to ${policy.capacity}` : ''}.`
}

export function tournamentStatusColor(status: Tournament['status']): string {
    return status === 'open'
        ? 'text-green-700 dark:text-green-400'
        : 'text-blue-700 dark:text-blue-300'
}

export function tournamentStatusText(tournament: Tournament, now = Date.now()): string {
    if (tournament.startsAt !== undefined) {
        const seconds = Math.max(0, Math.ceil((tournament.startsAt - now) / 1000))
        return seconds > 0 ? `Starting in ${seconds}s` : 'Starting…'
    }
    if (tournament.paused) return 'Scheduling paused'
    switch (tournament.status) {
        case 'draft':
            return 'Draft'
        case 'open':
            return 'Registration open'
        case 'finished':
            return 'Finished'
        case 'inProgress':
            return 'In progress'
        case 'locked':
            if (tournament.stages.some((stage) => stage.dispatch?.error)) return 'Start delayed'
            return tournament.nextTaskAt !== undefined ? 'Starting…' : 'Roster locked'
        case 'cancelled':
            return tournament.cancellationReason === 'undersubscribed'
                ? 'Cancelled — minimum roster not met'
                : 'Cancelled'
    }
}
