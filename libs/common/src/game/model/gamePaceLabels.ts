import { GamePace } from './gamePace.js'

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
        option: 'Fast · moves within an hour',
        summary: 'Fast · 1 h',
        line: 'Fast · within 1 h',
        limit: 'the 1 h pace'
    },
    [GamePace.Brisk]: {
        name: 'Brisk',
        option: 'Brisk · moves every few hours',
        summary: 'Brisk · 4 h',
        line: 'Brisk · within 4 h',
        limit: 'the 4 h pace'
    },
    [GamePace.Daily]: {
        name: 'Daily',
        option: 'Daily · moves within a day',
        summary: 'Daily',
        line: 'Daily · within a day',
        limit: 'the 1-day pace'
    },
    [GamePace.Relaxed]: {
        name: 'Relaxed',
        option: 'Relaxed · moves within about 3 days',
        summary: 'Relaxed · 3 days',
        line: 'Relaxed · within 3 days',
        limit: 'the 3-day pace'
    }
}
