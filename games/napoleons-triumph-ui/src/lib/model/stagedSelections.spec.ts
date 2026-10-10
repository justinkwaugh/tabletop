import { describe, expect, it } from 'vitest'
import { setStagedSelectionValue } from '@tabletop/frontend-components'
import { CommandKind } from '@tabletop/napoleons-triumph'
import {
    AttackWidth,
    attackerSelection,
    defenceSelection,
    emptyBattleSelections,
    hasManualBattleSelection,
    retreatSelection,
    undoBattleSelection
} from './battleSelection.js'
import { commandSelection, type CommandSelectionValues } from './commandSelection.js'
import {
    editedDeployment,
    recordSetupEdit,
    setupSelection,
    toggleSetupUnit,
    undoSetupSelection
} from './setupSelection.js'

function pickedUp() {
    return commandSelection.set(commandSelection.empty(), 'group', 'corps', 'manual')
}

describe('command selection', () => {
    it('clears later stages when an earlier one is set', () => {
        const commanded = commandSelection.set(pickedUp(), 'command', CommandKind.Detach, 'manual')
        const regrouped = commandSelection.set(commanded, 'group', 'other', 'manual')
        expect(commandSelection.value(regrouped, 'group')).toBe('other')
        expect(commandSelection.value(regrouped, 'units')).toBeUndefined()
        expect(commandSelection.value(regrouped, 'command')).toBeUndefined()
    })

    it('undoes the latest manual stage and what followed it, one press at a time', () => {
        const announced = commandSelection.set(
            commandSelection.set(pickedUp(), 'command', CommandKind.Corps, 'manual'),
            'guardAttack',
            true,
            'manual'
        )
        const commanded = commandSelection.undo(announced)
        expect(commandSelection.value(commanded, 'guardAttack')).toBeUndefined()
        expect(commandSelection.value(commanded, 'command')).toBe(CommandKind.Corps)

        const picked = commandSelection.undo(commanded)
        expect(commandSelection.value(picked, 'command')).toBeUndefined()
        expect(commandSelection.value(picked, 'group')).toBe('corps')

        const nothing = commandSelection.undo(picked)
        expect(nothing).toEqual(commandSelection.empty())
    })

    it('returns to the units a pick-up starts with when leaving some out is undone', () => {
        const thinned = commandSelection.set(pickedUp(), 'units', ['F01'], 'manual')
        const restored = commandSelection.undo(thinned)
        expect(commandSelection.value(restored, 'units')).toBeUndefined()
        expect(commandSelection.value(restored, 'group')).toBe('corps')
    })

    it('leaves Undo to the last action when only automatic picks remain', () => {
        const automatic = commandSelection.set(commandSelection.empty(), 'units', ['F01'], 'auto')
        expect(commandSelection.hasManual(automatic)).toBe(false)
        expect(commandSelection.undo(automatic)).toEqual(automatic)
    })

    it('rejects a stage its order does not hold', () => {
        expect(() =>
            setStagedSelectionValue<CommandSelectionValues, 'guardAttack'>(
                commandSelection.empty(),
                ['group', 'units'],
                'guardAttack',
                true,
                'manual'
            )
        ).toThrow(/does not exist in stage order/)
    })
})

describe('battle selections', () => {
    it('keeps the defence picked while a retreat is arranged, and returns to it', () => {
        const start = emptyBattleSelections()
        const defended = {
            ...start,
            defence: defenceSelection.set(start.defence, 'defenders', ['A01'], 'manual')
        }
        const retreating = {
            ...defended,
            defence: defenceSelection.set(defended.defence, 'retreating', true, 'manual')
        }
        const sent = {
            ...retreating,
            retreat: retreatSelection.set(retreating.retreat, 'destinations', { A01: 83 }, 'manual')
        }
        const afterFirst = undoBattleSelection(sent)
        expect(retreatSelection.hasManual(afterFirst.retreat)).toBe(false)
        expect(defenceSelection.value(afterFirst.defence, 'retreating')).toBe(true)

        const afterSecond = undoBattleSelection(afterFirst)
        expect(defenceSelection.value(afterSecond.defence, 'retreating')).toBeUndefined()
        expect(defenceSelection.value(afterSecond.defence, 'defenders')).toEqual(['A01'])

        const afterThird = undoBattleSelection(afterSecond)
        expect(hasManualBattleSelection(afterThird)).toBe(false)
    })

    it('starts the attack choices over when the attackers change, but keeps them when only a leader does', () => {
        const start = attackerSelection.set(
            attackerSelection.empty(),
            'attackers',
            ['F01', 'F02'],
            'manual'
        )
        const narrow = attackerSelection.set(
            attackerSelection.set(start, 'command', CommandKind.Detach, 'manual'),
            'width',
            AttackWidth.Narrow,
            'manual'
        )
        const led = attackerSelection.set(narrow, 'leaders', ['F01'], 'manual')
        expect(attackerSelection.value(led, 'width')).toBe(AttackWidth.Narrow)
        expect(attackerSelection.value(led, 'command')).toBe(CommandKind.Detach)

        const renamed = attackerSelection.set(led, 'attackers', ['F03'], 'manual')
        expect(attackerSelection.value(renamed, 'command')).toBeUndefined()
        expect(attackerSelection.value(renamed, 'leaders')).toBeUndefined()
    })
})

describe('set-up selection', () => {
    const first = { corps: [], detachments: [] }
    const second = { corps: [], detachments: [{ unitId: 'F01', position: { locale: 53 } }] }

    it('steps back one arrangement at a time, the picked unit first', () => {
        const edited = recordSetupEdit(recordSetupEdit(setupSelection.empty(), first), second)
        const picked = toggleSetupUnit(edited, 'F02')
        expect(setupSelection.value(picked, 'unit')).toBe('F02')

        const unpicked = undoSetupSelection(picked)
        expect(setupSelection.value(unpicked, 'unit')).toBeUndefined()
        expect(editedDeployment(unpicked)).toEqual(second)

        const earlier = undoSetupSelection(unpicked)
        expect(editedDeployment(earlier)).toEqual(first)

        const untouched = undoSetupSelection(earlier)
        expect(editedDeployment(untouched)).toBeUndefined()
        expect(setupSelection.hasManual(untouched)).toBe(false)
    })

    it('puts a picked unit down when it is tapped again or the arrangement changes', () => {
        const picked = toggleSetupUnit(setupSelection.empty(), 'F02')
        expect(setupSelection.value(toggleSetupUnit(picked, 'F02'), 'unit')).toBeUndefined()
        expect(setupSelection.value(recordSetupEdit(picked, first), 'unit')).toBeUndefined()
    })
})
