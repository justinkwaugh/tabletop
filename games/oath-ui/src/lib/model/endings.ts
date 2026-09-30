import { assert, assertExists, GameResult } from '@tabletop/common'
import { WIN_RULES, type HydratedOathGameState, type WinRule } from '@tabletop/oath'

// R-3 — Oath has no score; the ending that fired is the fact worth stating.
// Keyed by `WinRule` so the compiler refuses a key the engine cannot emit.
export const ENDINGS: Record<WinRule, string> = {
    'R-3.1': 'as Usurper — an Exile holding the Oathkeeper title on its Usurper side',
    'R-3.2': 'as Visionary — an Exile completing a revealed Vision',
    'R-3.3': 'by Stable Regime — the end die came up, and the empire held',
    'R-3.3.1': 'as Successor — a Citizen met the Successor goal and inherited the empire',
    'R-3.4.1': 'by War Exhaustion — the Empire held the Oathkeeper title',
    'R-3.4.2': 'by War Exhaustion — an Exile was the Usurper',
    'R-3.4.3': 'by War Exhaustion — an Exile met a revealed Vision’s goal',
    'R-3.4.4': 'by War Exhaustion — the Empire endured, by the terminal fallback'
}

export function isWinRule(value: string): value is WinRule {
    return WIN_RULES.some((rule) => rule === value)
}

// R-3 — every ending is one player's win.
export function recordedWinner(gameState: HydratedOathGameState): string {
    assert(
        gameState.result === GameResult.Win,
        `An Oath game ends only in a win, not ${gameState.result}`
    )
    const [winner] = gameState.winningPlayerIds
    assertExists(winner, 'The ending action records its winner')
    return winner
}
