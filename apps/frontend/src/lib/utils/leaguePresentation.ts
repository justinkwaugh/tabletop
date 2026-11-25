import {
    leagueLevelName,
    type LeagueListEntry,
    type LeagueMyPlace,
    type LeagueSeason,
    type LeagueSeasonSummary,
    type LeagueShape
} from '@tabletop/common'
import { m } from '$lib/paraglide/messages'
import { getLocale } from '$lib/paraglide/runtime'

type SeasonState = Pick<LeagueSeason, 'status' | 'signUpClosesAt' | 'undersubscribed'>

export function leagueShapeText(shape: LeagueShape): string {
    return shape === 'ladder' ? m.leagues_shape_ladder() : m.leagues_shape_pyramid()
}

export function leagueSignUpOpen(season: SeasonState | undefined, now = Date.now()): boolean {
    return (
        season?.status === 'signUp' &&
        (now < season.signUpClosesAt || season.undersubscribed === true)
    )
}

export function leagueSeasonStatusText(season: SeasonState | undefined, now = Date.now()): string {
    if (!season) return m.leagues_status_not_open()
    switch (season.status) {
        case 'signUp':
            if (season.undersubscribed) return m.leagues_status_waiting_for_players()
            return now < season.signUpClosesAt
                ? m.leagues_status_sign_up_open()
                : m.leagues_status_sign_up_closed()
        case 'starting':
            return m.leagues_status_starting()
        case 'inProgress':
            return m.leagues_status_in_progress()
        case 'finished':
            return m.leagues_status_finished()
        case 'cancelled':
            return m.leagues_status_cancelled()
    }
}

export function leagueSeasonStatusColor(season: SeasonState | undefined, now = Date.now()) {
    if (season?.status === 'cancelled') return 'text-gray-500 dark:text-gray-400'
    return leagueSignUpOpen(season, now)
        ? 'text-green-700 dark:text-green-400'
        : 'text-blue-700 dark:text-blue-300'
}

export function leagueDateText(time: number): string {
    return new Date(time).toLocaleString(getLocale(), {
        day: 'numeric',
        month: 'short',
        hour: 'numeric',
        minute: '2-digit'
    })
}

export function leagueLevelText(level: number): string {
    return m.leagues_level({ level: leagueLevelName(level) })
}

export function leagueSeasonName(season: Pick<LeagueSeason, 'number' | 'seeding'>): string {
    return season.seeding
        ? m.leagues_season_name_seeding({ number: season.number })
        : m.leagues_season_name({ number: season.number })
}

export function leagueClosesInText(closesAt: number, now = Date.now()): string {
    const remaining = closesAt - now
    if (remaining <= 0) return m.leagues_closing_now()
    const minutes = Math.ceil(remaining / 60_000)
    if (minutes < 60) return m.leagues_closes_in_minutes({ count: minutes })
    const hours = Math.round(minutes / 60)
    if (hours < 48) return m.leagues_closes_in_hours({ count: hours })
    return m.leagues_closes_in_days({ count: Math.round(hours / 24) })
}

export function leagueMyPlaceText(place: LeagueMyPlace): string {
    switch (place.status) {
        case 'signedUp':
            return m.leagues_my_place_signed_up()
        case 'held':
            return m.leagues_my_place_held({ level: leagueLevelName(place.level) })
        case 'inGroup':
            return m.leagues_my_place_in_group({ group: place.groupId })
    }
}

/** The status line of a league card: draft, no season yet, or the current season and its state. */
export function leagueListStatusText(
    { league, season }: LeagueListEntry,
    now = Date.now()
): string {
    if (league.status === 'draft') return m.leagues_status_draft()
    if (!season) return leagueSeasonStatusText(undefined, now)
    return m.leagues_season_with_status({
        season: leagueSeasonName(season),
        status: leagueSeasonStatusText(season, now)
    })
}

export function leagueRosterText(
    season: Pick<LeagueSeasonSummary, 'status' | 'players' | 'minimumPlayers'>
): string {
    if (season.status !== 'signUp') return m.player_count({ count: season.players })
    return season.players >= season.minimumPlayers
        ? m.leagues_roster_signed_up({ count: season.players })
        : m.leagues_roster_needed({ count: season.players, minimum: season.minimumPlayers })
}

/** Whether a league card counts down to the sign-up deadline; an undersubscribed season has none. */
export function leagueShowsSignUpDeadline<
    Season extends Pick<LeagueSeasonSummary, 'status' | 'undersubscribed'>
>(season: Season | undefined): season is Season {
    return season?.status === 'signUp' && !season.undersubscribed
}

export function sortLeaguesByName(leagues: LeagueListEntry[]): LeagueListEntry[] {
    return leagues.sort((a, b) => a.league.name.localeCompare(b.league.name))
}
