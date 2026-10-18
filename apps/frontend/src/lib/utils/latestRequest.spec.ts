import { describe, expect, it } from 'vitest'
import { LatestRequest } from './latestRequest'

describe('LatestRequest', () => {
    it('keeps only the newest load current, and none after cancel', () => {
        const requests = new LatestRequest()
        const first = requests.begin()
        expect(first()).toBe(true)
        const second = requests.begin()
        expect(first()).toBe(false)
        expect(second()).toBe(true)
        requests.cancel()
        expect(second()).toBe(false)
    })
})
