import { BattleRole } from './battleStage.js'

export interface RoleMark {
    letter?: string
    /** Drawn larger and thickened: the face's own bold is too slight for a figure this small. */
    heavy?: true
}

/** The steps a unit is to lose, printed where its role's letter would be. */
export function lossMark(steps: number): RoleMark | undefined {
    return steps > 0 ? { letter: `−${steps}`, heavy: true } : undefined
}

export function roleMarkOf(role: BattleRole): RoleMark | undefined {
    switch (role) {
        case BattleRole.Defends:
            return { letter: 'D' }
        case BattleRole.Attacks:
            return { letter: 'A' }
        case BattleRole.CounterAttacks:
            return { letter: 'C' }
        case BattleRole.Leads:
            return { letter: 'L' }
        case BattleRole.Advances:
        case BattleRole.RetreatsAlone:
            return {}
        case BattleRole.PassedBy:
            return undefined
    }
}
