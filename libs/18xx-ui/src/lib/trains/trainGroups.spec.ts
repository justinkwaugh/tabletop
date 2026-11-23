import { describe, expect, it } from 'vitest'
import { trainGroups } from './trainGroups.js'

describe('trainGroups', () => {
    it('counts each kind of train in the order it first appears', () => {
        expect(trainGroups(['2', '2', '3', '2'])).toEqual([
            { definitionId: '2', count: 3 },
            { definitionId: '3', count: 1 }
        ])
    })
})
