import { describe, expect, it } from 'vitest'
import { ATTACK_DIE_FACES, DEFENSE_DIE_FACES, END_DIE_FACES } from '@tabletop/oath'
import {
    attackFaceImage,
    defenseFaceImage,
    diceImageKeys,
    endDieImage
} from './diceImages.js'

/** Every face the engine's dice can roll has the picture the component prints. */
describe('dice face coverage', () => {
    it('R-5.5.5 — every attack face resolves, and skull / hollow / sword differ', () => {
        const urls = ATTACK_DIE_FACES.map(attackFaceImage)
        expect(urls.every(Boolean)).toBe(true)
        expect(new Set(urls).size).toBe(3)
    })

    it('R-5.5.4 — every defense face resolves, and blank / shield / two / doubling differ', () => {
        const urls = DEFENSE_DIE_FACES.map(defenseFaceImage)
        expect(urls.every(Boolean)).toBe(true)
        expect(new Set(urls).size).toBe(4)
    })

    it('R-3.3 — every end-die value resolves to its own face', () => {
        const urls = END_DIE_FACES.map(endDieImage)
        expect(urls.every(Boolean)).toBe(true)
        expect(new Set(urls).size).toBe(6)
        expect(() => endDieImage(7)).toThrow()
    })

    it('no face is orphaned — every file is one the lookups can reach', () => {
        const reachable = new Set([
            ...ATTACK_DIE_FACES.map(attackFaceImage),
            ...DEFENSE_DIE_FACES.map(defenseFaceImage),
            ...END_DIE_FACES.map(endDieImage)
        ])
        expect(diceImageKeys()).toHaveLength(reachable.size)
    })
})
