import { describe, expect, it } from 'vitest'
import {
    changePreferences,
    resolvePreferences,
    type PreferenceRecord,
    type TitlePreferenceData
} from '@tabletop/common'
import { EighteenXXPreferenceDefinition } from './preferences.js'

const family = EighteenXXPreferenceDefinition.family

function familyRecord(values: Record<string, unknown>): PreferenceRecord {
    return { version: 1, revision: 0, values }
}

function data(values: Record<string, unknown>): TitlePreferenceData {
    return { title: familyRecord({}), family: familyRecord(values) }
}

// Every 18xx title validates the one family record against the schema it last shipped, so a
// value a later version saves must still load and accept writes in this one.
describe('18xx display preferences across versions', () => {
    const later = {
        tokenStyle: 'outlined',
        tileStyle: 'colorBlind',
        tableStyle: 'sepia',
        tileColors: { yellow: '#f5c542', lightBrown: '#c8a27a' },
        routeColors: { '0': '#123456', '12': '#654321' },
        playerColors: { red: '#aa0000', teal: '#008080' },
        tableColors: { background: '#101010', tabUnderline: '#ff0000' }
    }

    it('loads values a later version adds', () => {
        const resolved = resolvePreferences(EighteenXXPreferenceDefinition, data(later))
        expect(resolved.tableStyle).toBe('sepia')
        expect(resolved.routeColors['12']).toBe('#654321')
    })

    it('saves another preference beside them', () => {
        const record = changePreferences(family, familyRecord(later), {
            scope: 'family',
            version: 1,
            set: { historyOrder: 'newestFirst' },
            unset: []
        })
        expect(record.values).toMatchObject({ ...later, historyOrder: 'newestFirst' })
    })

    it('loads preferences saved before the display settings', () => {
        const resolved = resolvePreferences(
            EighteenXXPreferenceDefinition,
            data({ companyCardsWrap: false, theme: 'light' })
        )
        expect(resolved.companyCardsWrap).toBe(false)
        expect(resolved.tableStyle).toBe('default')
        expect(resolved.playerTint).toBe(15)
    })

    it('keeps every other choice when one stored value is beyond this version', () => {
        const resolved = resolvePreferences(
            EighteenXXPreferenceDefinition,
            data({ playerTint: 150, tableColors: 'none', companyCardsWrap: false })
        )
        expect(resolved.playerTint).toBe(15)
        expect(resolved.tableColors).toEqual({})
        expect(resolved.companyCardsWrap).toBe(false)
    })

    it('refuses a color that is not lowercase #rrggbb', () => {
        expect(() =>
            changePreferences(family, familyRecord({}), {
                scope: 'family',
                version: 1,
                set: { tableColors: { text: 'red' } },
                unset: []
            })
        ).toThrow()
    })
})
