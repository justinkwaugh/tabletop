import {
    formatTournamentAveragePlace,
    formatTournamentTiebreaks,
    formatTwoDecimals,
    ranksByAveragePlace,
    tournamentCapacity,
    standingsTiebreakRule,
    type Tournament,
    type TournamentRules,
    type TournamentScore,
    type TiebreakRule,
    type TournamentStanding
} from '@tabletop/common'
import { m } from '$lib/paraglide/messages'
import { getLocale } from '$lib/paraglide/runtime'
import { startCountdownText } from './startCountdown'

export function tournamentTiebreakTexts(
    rows: Pick<
        TournamentStanding,
        'userId' | 'completed' | 'tiebreak' | 'pointsBehind' | 'shareOfWinner'
    >[]
): Map<string, string> {
    const texts = formatTournamentTiebreaks(rows, getLocale())
    return new Map(rows.map((row, index) => [row.userId, texts[index] ?? '—']))
}

const TIEBREAK_DESCRIPTIONS: Record<TiebreakRule, () => string> = {
    pointsBehind: m.tournaments_tiebreak_points_behind,
    shareOfWinner: m.tournaments_tiebreak_share_of_winner
}

export function tournamentTiebreakDescriptionText(
    rows: Pick<TournamentScore, 'pointsBehind' | 'shareOfWinner'>[]
): string {
    const rule = standingsTiebreakRule(rows)
    return rule ? TIEBREAK_DESCRIPTIONS[rule]() : m.tournaments_tiebreak_score_sum()
}

export function tournamentScoringText(
    rules: Pick<TournamentRules, 'scoring'>,
    format?: Pick<Tournament['format'], 'kind'>
): string {
    if (format?.kind === 'knockout') return m.tournaments_scoring_knockout()
    return ranksByAveragePlace(rules)
        ? m.tournaments_scoring_average_place()
        : m.tournaments_scoring_wins()
}

export function standingScoreText(score: number): string {
    return Number.isInteger(score)
        ? score.toLocaleString(getLocale())
        : formatTwoDecimals(score, getLocale())
}

export function tournamentAveragePlaceText(
    row: Pick<TournamentScore, 'completed' | 'placeTotal'>
): string {
    return formatTournamentAveragePlace(row, getLocale()) ?? '—'
}

const formatNames = {
    mini: [m.tournaments_format_mini, m.tournaments_format_mini_tournament],
    knockout: [m.tournaments_format_knockout, m.tournaments_format_knockout_tournament],
    multiStage: [m.tournaments_format_multi_stage, m.tournaments_format_multi_stage_tournament]
} as const satisfies Record<Tournament['format']['kind'], readonly [() => string, () => string]>

export function tournamentFormatText(format: Pick<Tournament['format'], 'kind'>): string {
    return formatNames[format.kind][1]()
}

export function tournamentRosterText(tournament: Pick<Tournament, 'entrants' | 'rules'>): string {
    const capacity = tournamentCapacity(tournament.rules.registration)
    return capacity
        ? m.tournaments_roster_of_capacity({ count: tournament.entrants.length, capacity })
        : String(tournament.entrants.length)
}

export function tournamentTag(tournament: Pick<Tournament, 'format' | 'league'>): string {
    if (tournament.league) return m.tournaments_tag_league()
    return formatNames[tournament.format.kind][0]()
}

export function tournamentTagTitle(tournament: Pick<Tournament, 'format' | 'league'>): string {
    return tournament.league
        ? m.tournaments_tag_league_group()
        : tournamentFormatText(tournament.format)
}

export function tournamentLeagueHref(league: NonNullable<Tournament['league']>): string {
    return `/leagues/${encodeURIComponent(league.leagueId)}?season=${league.seasonId}`
}

export function tournamentRegistrationOpen(tournament: Tournament, now = Date.now()): boolean {
    return (
        tournament.status === 'open' &&
        (tournament.startsAt === undefined || now < tournament.startsAt) &&
        (tournament.rules.registration.kind !== 'deadline' ||
            now < tournament.rules.registration.closesAt)
    )
}

// A bare hour reads as a time only with AM/PM, so 24-hour languages get minutes too.
function registrationCloseTime(time: number): string {
    const locale = getLocale()
    const twelveHour = new Intl.DateTimeFormat(locale, { hour: 'numeric' }).resolvedOptions().hour12
    return new Date(time).toLocaleString(locale, {
        day: 'numeric',
        month: 'short',
        hour: 'numeric',
        minute: twelveHour ? undefined : '2-digit'
    })
}

export function tournamentRegistrationText(tournament: Tournament, now = Date.now()): string {
    if (tournament.startsAt !== undefined) return m.tournaments_registration_closes_at_start()
    const policy = tournament.rules.registration
    if (policy.kind === 'assigned') return m.tournaments_registration_assigned()
    if (policy.kind === 'whenFull')
        return m.tournaments_registration_starts_when_full({ capacity: policy.capacity })
    const date = registrationCloseTime(policy.closesAt)
    const minimum = policy.minimumEntrants
    const closes = now < policy.closesAt
    if (policy.capacity) {
        const inputs = { date, minimum, capacity: policy.capacity }
        return closes
            ? m.tournaments_registration_closes_on_capped(inputs)
            : m.tournaments_registration_closed_on_capped(inputs)
    }
    return closes
        ? m.tournaments_registration_closes_on({ date, minimum })
        : m.tournaments_registration_closed_on({ date, minimum })
}

export function tournamentStatusColor(tournament: Tournament, now = Date.now()): string {
    return tournamentRegistrationOpen(tournament, now)
        ? 'text-green-700 dark:text-green-400'
        : 'text-blue-700 dark:text-blue-300'
}

export function tournamentSummaryText(tournament: Tournament, now = Date.now()): string {
    if (tournament.status === 'finished') {
        const date = tournament.finishedAt
            ? new Date(tournament.finishedAt).toLocaleDateString(getLocale(), {
                  day: 'numeric',
                  month: 'short'
              })
            : ''
        return date
            ? m.tournaments_summary_completed_on({ date })
            : m.tournaments_summary_completed()
    }
    if (tournament.status === 'inProgress') {
        return m.tournaments_games_finished({
            count: tournament.stages[0]?.dispatch?.finished.length ?? 0
        })
    }
    if (tournament.status === 'locked') return m.tournaments_status_registration_closed()
    return tournamentRegistrationText(tournament, now)
}

export function tournamentStatusText(tournament: Tournament, now = Date.now()): string {
    if (tournament.paused) return m.tournaments_status_scheduling_paused()
    if (tournament.schedulingError && ['open', 'locked'].includes(tournament.status))
        return m.tournaments_status_start_delayed()
    if (tournament.startsAt !== undefined) return startCountdownText(tournament.startsAt, now)
    switch (tournament.status) {
        case 'draft':
            return m.tournaments_status_draft()
        case 'open':
            return tournamentRegistrationOpen(tournament, now)
                ? m.tournaments_status_registration_open()
                : m.tournaments_status_registration_closed()
        case 'finished':
            return m.tournaments_status_finished()
        case 'inProgress':
            return m.tournaments_status_in_progress()
        case 'locked':
            return tournament.nextTaskAt !== undefined
                ? m.tournaments_status_starting()
                : m.tournaments_status_roster_locked()
        case 'cancelled':
            return tournament.cancellationReason === 'undersubscribed'
                ? m.tournaments_status_cancelled_undersubscribed()
                : m.tournaments_status_cancelled()
    }
}
