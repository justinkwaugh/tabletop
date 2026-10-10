import { describe, expect, it } from 'vitest'
import { CommandKind } from '@tabletop/napoleons-triumph'
import {
    clearCommandSelection,
    emptySelection,
    hasManualCommandSelection,
    popCommandSelection,
    setCommandSelection
} from './selection.js'

function picked() {
    const group = setCommandSelection(emptySelection(), 'group', 'corps', 'manual')
    return setCommandSelection(group, 'units', ['F01', 'F02'], 'auto')
}

describe('command selection', () => {
    it('drops later stages when an earlier one is chosen again', () => {
        const withCommand = setCommandSelection(picked(), 'command', CommandKind.Detach, 'manual')
        const regrouped = setCommandSelection(withCommand, 'group', 'other', 'manual')
        expect(regrouped.group?.value).toBe('other')
        expect(regrouped.units).toBeUndefined()
        expect(regrouped.command).toBeUndefined()
    })

    it('undoes the latest manual choice and the automatic ones that followed from it', () => {
        const withGuard = setCommandSelection(
            setCommandSelection(picked(), 'command', CommandKind.Corps, 'manual'),
            'guard',
            true,
            'manual'
        )
        const noGuard = popCommandSelection(withGuard)
        expect(noGuard.guard).toBeUndefined()
        expect(noGuard.command?.value).toBe(CommandKind.Corps)

        const noCommand = popCommandSelection(noGuard)
        expect(noCommand.command).toBeUndefined()
        expect(noCommand.units?.value).toEqual(['F01', 'F02'])

        const nothing = popCommandSelection(noCommand)
        expect(hasManualCommandSelection(nothing)).toBe(false)
        expect(nothing.units).toBeUndefined()
    })

    it('clears a stage and everything after it', () => {
        const cleared = clearCommandSelection(picked(), 'units')
        expect(cleared.group?.value).toBe('corps')
        expect(cleared.units).toBeUndefined()
    })
})
