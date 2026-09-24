import { describe, expect, it } from 'vitest'
import {
    ConfigOptionType,
    defaultGameConfig,
    presentedBooleanValue,
    storedBooleanValue,
    type BooleanConfigOption
} from './gameConfig.js'

const plain: BooleanConfigOption = {
    id: 'expert',
    name: 'Expert rules',
    description: '',
    type: ConfigOptionType.Boolean,
    default: false
}

const inverted: BooleanConfigOption = {
    id: 'publicMoney',
    name: 'Private money',
    description: '',
    type: ConfigOptionType.Boolean,
    default: true,
    invertPresentation: true
}

describe('presentedBooleanValue', () => {
    it('shows a plain option as stored', () => {
        expect(presentedBooleanValue(plain, true)).toBe(true)
        expect(presentedBooleanValue(plain, false)).toBe(false)
    })

    it('shows an inverted option as the negation of what is stored', () => {
        expect(presentedBooleanValue(inverted, true)).toBe(false)
        expect(presentedBooleanValue(inverted, false)).toBe(true)
    })

    it('falls back to the default for a missing or non-boolean value, then presents that', () => {
        expect(presentedBooleanValue(plain, undefined)).toBe(false)
        expect(presentedBooleanValue(plain, null)).toBe(false)
        expect(presentedBooleanValue(inverted, undefined)).toBe(false)
        expect(presentedBooleanValue(inverted, 'yes')).toBe(false)
    })
})

describe('storedBooleanValue', () => {
    it('round-trips through the presentation in both directions', () => {
        for (const option of [plain, inverted]) {
            for (const stored of [true, false]) {
                expect(storedBooleanValue(option, presentedBooleanValue(option, stored))).toBe(
                    stored
                )
            }
        }
    })

    it('stores the negation of an inverted toggle', () => {
        expect(storedBooleanValue(inverted, true)).toBe(false)
        expect(storedBooleanValue(inverted, false)).toBe(true)
    })
})

describe('defaultGameConfig with an inverted option', () => {
    // The guarantee that existing games are untouched: presentation never reaches storage, so
    // a fresh game still records the raw default the readers expect.
    it('still records the raw stored default', () => {
        expect(defaultGameConfig([inverted])).toEqual({ publicMoney: true })
    })
})
