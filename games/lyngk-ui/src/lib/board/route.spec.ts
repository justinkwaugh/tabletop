import { describe, expect, it } from 'vitest'
import { chainLinks } from './route.js'

const c = (q: number, r: number) => ({ q, r })

describe('chainLinks', () => {
    it('lists each link of every chain once, whichever way it runs', () => {
        const links = chainLinks([
            { from: c(0, -3), via: [], to: c(1, -3) },
            { from: c(0, -3), via: [c(0, -1)], to: c(0, 2) },
            { from: c(0, -3), via: [c(0, -1), c(2, -1)], to: c(2, 1) },
            { from: c(0, -3), via: [c(0, -1), c(2, -1)], to: c(3, -2) }
        ])
        expect(links).toEqual([
            [c(0, -3), c(0, -1)],
            [c(0, -1), c(2, -1)]
        ])
    })
})
