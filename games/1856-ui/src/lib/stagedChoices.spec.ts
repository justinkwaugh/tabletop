import { describe, expect, it } from 'vitest'
import { StagedSelection } from '@tabletop/18xx-ui'
import { defaultKeptTrains, toggled } from './stagedChoices.js'

describe('1856 CGR station and train choices', () => {
    it('adds a station or train not yet chosen and takes out one already chosen', () => {
        expect(toggled([], 'GT:2')).toEqual(['GT:2'])
        expect(toggled(['GT:2', 'CPR:3'], 'GT:2')).toEqual(['CPR:3'])
    })

    it('starts the CGR with its permanent trains kept, up to three', () => {
        const trains = [
            { id: 'a', definitionId: '4' },
            { id: 'b', definitionId: '6' },
            { id: 'c', definitionId: '5' },
            { id: 'd', definitionId: '6' },
            { id: 'e', definitionId: 'D' }
        ]
        expect(defaultKeptTrains(trains)).toEqual(['b', 'c', 'd'])
        expect(defaultKeptTrains([{ id: 'a', definitionId: '4' }])).toEqual([])
    })

    it('drops the choice made so far on Undo, going back to the starting choice', () => {
        const kept = new StagedSelection<{ trains: readonly string[] }>(['trains'])
        kept.choose('trains', toggled(defaultKeptTrains([{ id: 'b', definitionId: '6' }]), 'a'))
        expect(kept.value('trains')).toEqual(['b', 'a'])
        expect(kept.undo()).toBe(true)
        expect(kept.value('trains')).toBeUndefined()
        expect(kept.undo()).toBe(false)
    })
})
