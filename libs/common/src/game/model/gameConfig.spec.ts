import { describe, expect, it } from 'vitest'
import { ConfigOptionType, listOptionDescription, type ListConfigOption } from './gameConfig.js'

const option: ListConfigOption = {
    id: 'rules',
    type: ConfigOptionType.List,
    name: 'Rules',
    description: 'Both rule sets',
    default: 'a',
    options: [
        { name: 'A', value: 'a', description: 'Rule set A' },
        { name: 'B', value: 'b' }
    ]
}

describe('listOptionDescription', () => {
    it('describes the selected choice', () => {
        expect(listOptionDescription(option, 'a')).toBe('Rule set A')
    })

    it('describes the default choice when nothing is selected', () => {
        expect(listOptionDescription(option, undefined)).toBe('Rule set A')
        expect(listOptionDescription(option, null)).toBe('Rule set A')
    })

    it("falls back to the option's description for a choice without one", () => {
        expect(listOptionDescription(option, 'b')).toBe('Both rule sets')
    })
})
