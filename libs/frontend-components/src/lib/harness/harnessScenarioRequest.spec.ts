import { describe, expect, test } from 'vitest'
import { pendingScenarioRequests, type HarnessScenarioRequest } from './harnessScenarioRequest.js'

function request(id: string): HarnessScenarioRequest {
    return {
        format: 1,
        id,
        label: id,
        description: `A board for ${id}`,
        title: 'countdown',
        requestedAt: '2026-10-10T12:00:00.000Z'
    }
}

describe('pendingScenarioRequests', () => {
    test('lists requests that have no recording yet', () => {
        const files = {
            'waiting.json': request('waiting'),
            'recorded.json': request('recorded')
        }

        expect(pendingScenarioRequests(files, new Set(['recorded']))).toEqual([request('waiting')])
    })

    test('leaves out a file that is not a request', () => {
        expect(pendingScenarioRequests({ 'old.json': { id: 'old' } }, new Set())).toEqual([])
    })
})
