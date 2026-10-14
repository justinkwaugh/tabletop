import { describe, expect, it } from 'vitest'
import { BattleRole } from './battleStage.js'
import { roleMarkOf } from './roleMark.js'

describe('the letter a named block carries', () => {
    it('names what the unit is doing in the attack', () => {
        expect(roleMarkOf(BattleRole.Defends)).toEqual({ letter: 'D' })
        expect(roleMarkOf(BattleRole.Attacks)).toEqual({ letter: 'A' })
        expect(roleMarkOf(BattleRole.CounterAttacks)).toEqual({ letter: 'C' })
        expect(roleMarkOf(BattleRole.Leads)).toEqual({ letter: 'L' })
    })

    it('is left off a unit picked to advance or to retreat alone, and nothing marks one an attack passes by', () => {
        expect(roleMarkOf(BattleRole.Advances)).toEqual({})
        expect(roleMarkOf(BattleRole.RetreatsAlone)).toEqual({})
        expect(roleMarkOf(BattleRole.PassedBy)).toBeUndefined()
    })
})
