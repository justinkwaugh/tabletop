import {
    leagueLevelName,
    type LeagueMyPlace,
    type LeagueSeason,
    type LeagueShape
} from '@tabletop/common'

type SeasonState = Pick<LeagueSeason, 'status' | 'signUpClosesAt' | 'undersubscribed'>

export function leagueShapeText(shape: LeagueShape): string {
    return shape === 'ladder' ? 'Ladder' : 'Pyramid'
}

export function leagueSignUpOpen(season: SeasonState | undefined, now = Date.now()): boolean {
    return (
        season?.status === 'signUp' &&
        (now < season.signUpClosesAt || season.undersubscribed === true)
    )
}

export function leagueSeasonStatusText(season: SeasonState | undefined, now = Date.now()): string {
    if (!season) return 'Not open yet'
    switch (season.status) {
        case 'signUp':
            if (season.undersubscribed) return 'Waiting for more players'
            return now < season.signUpClosesAt ? 'Sign-up open' : 'Sign-up closed'
        case 'starting':
            return 'Starting…'
        case 'inProgress':
            return 'In progress'
        case 'finished':
            return 'Finished'
        case 'cancelled':
            return 'Cancelled'
    }
}

export function leagueSeasonStatusColor(season: SeasonState | undefined, now = Date.now()) {
    if (season?.status === 'cancelled') return 'text-gray-500 dark:text-gray-400'
    return leagueSignUpOpen(season, now)
        ? 'text-green-700 dark:text-green-400'
        : 'text-blue-700 dark:text-blue-300'
}

export function leagueDateText(time: number): string {
    return new Date(time).toLocaleString(undefined, {
        day: 'numeric',
        month: 'short',
        hour: 'numeric',
        minute: '2-digit'
    })
}

export function leagueLevelText(level: number): string {
    return `Level ${leagueLevelName(level)}`
}

export function leagueSeasonName(season: Pick<LeagueSeason, 'number' | 'seeding'>): string {
    return season.seeding ? `Season ${season.number} · Seeding` : `Season ${season.number}`
}

export function leagueClosesInText(closesAt: number, now = Date.now()): string {
    const remaining = closesAt - now
    if (remaining <= 0) return 'Closing now'
    const minutes = Math.ceil(remaining / 60_000)
    if (minutes < 60) return `Closes in ${minutes} minute${minutes === 1 ? '' : 's'}`
    const hours = Math.round(minutes / 60)
    if (hours < 48) return `Closes in ${hours} hour${hours === 1 ? '' : 's'}`
    return `Closes in ${Math.round(hours / 24)} days`
}

export function leagueMyPlaceText(place: LeagueMyPlace): string {
    switch (place.status) {
        case 'signedUp':
            return "You're signed up"
        case 'held':
            return `Your place in ${leagueLevelText(place.level)} is held. Confirm it to play.`
        case 'inGroup':
            return `You're in Group ${place.groupId}`
    }
}
