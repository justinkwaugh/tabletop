import { GamePace } from '@tabletop/common'

export type GamePaceLabels = {
    name: string
    option: string
    summary: string
    line: string
    limit: string
}

export const GAME_PACE_LABELS: Record<GamePace, GamePaceLabels> = {
    [GamePace.Live]: {
        name: 'Live',
        option: 'Live · playing together now',
        summary: 'Live',
        line: 'Live',
        limit: 'the Live pace'
    },
    [GamePace.Fast]: {
        name: 'Fast',
        option: 'Fast · move within about an hour',
        summary: 'Fast · 1 h',
        line: 'Fast · within 1 h',
        limit: 'the 1 h pace'
    },
    [GamePace.SameDay]: {
        name: 'Same day',
        option: 'Same day · move within about 8 hours',
        summary: 'Same day · 8 h',
        line: 'Same day · within 8 h',
        limit: 'the 8 h pace'
    },
    [GamePace.Daily]: {
        name: 'Daily',
        option: 'Daily · move within a day',
        summary: 'Daily',
        line: 'Daily · within a day',
        limit: 'the 1-day pace'
    },
    [GamePace.Relaxed]: {
        name: 'Relaxed',
        option: 'Relaxed · move within about 3 days',
        summary: 'Relaxed · 3 days',
        line: 'Relaxed · within 3 days',
        limit: 'the 3-day pace'
    }
}
