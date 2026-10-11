import { BattleRole } from './battleStage.js'

export interface RoleMark {
    letter?: string
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
        case BattleRole.Stays:
        case BattleRole.PassedBy:
            return undefined
    }
}
