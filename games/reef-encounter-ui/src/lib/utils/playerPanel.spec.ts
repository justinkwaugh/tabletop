import { describe, expect, it } from 'vitest'
import { shrimpsEaten } from './playerPanel.js'

describe('the shrimps a parrotfish ate', () => {
    it('says nothing before the first', () => {
        expect(shrimpsEaten(false, 0)).toBeUndefined()
    })

    it('counts every shrimp when the parrotfish is visible', () => {
        expect(shrimpsEaten(true, 0)).toBe('ate 1 shrimp')
        expect(shrimpsEaten(true, 2)).toBe('ate 3 shrimps')
    })

    it('counts only the open-sea shrimp as a minimum when the rest are concealed', () => {
        expect(shrimpsEaten(true, undefined)).toBe('Ate at least 1 shrimp')
    })
})
