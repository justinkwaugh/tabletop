/** R-3 — how an Oath game is won; the chronicle (R-8) stores it, so it lives with the model. */

export enum WinKind {
    /** R-3.1 */
    Usurper = 'usurper',
    /** R-3.2 */
    Visionary = 'visionary',
    /** R-3.3 */
    StableRegime = 'stableRegime',
    /** R-3.3.1 */
    Successor = 'successor',
    /** R-3.4 */
    WarExhaustion = 'warExhaustion'
}

/** R-3.4 has its own four steps, and R-3.3.1 fires under R-3.3, R-3.4.1 or R-3.4.4. */
export const WIN_RULES = [
    'R-3.1',
    'R-3.2',
    'R-3.3',
    'R-3.3.1',
    'R-3.4.1',
    'R-3.4.2',
    'R-3.4.3',
    'R-3.4.4'
] as const

export type WinRule = (typeof WIN_RULES)[number]
