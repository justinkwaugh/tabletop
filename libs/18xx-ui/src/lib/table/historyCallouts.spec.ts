import { describe, expect, it } from 'vitest'
import { descriptionCallouts } from './historyCallouts.js'

describe('descriptionCallouts', () => {
    it('calls out a limit change, then the title’s own events', () => {
        expect(
            descriptionCallouts({
                text: 'Phase 5',
                certificateLimit: { from: 16, to: 12 },
                callouts: [{ title: 'Earthquake', text: 'The city is lost.' }]
            })
        ).toEqual([
            {
                kind: 'certificate-limit',
                title: 'Certificate limit drops',
                text: 'From 16 to 12 certificates per player.'
            },
            { kind: 'title-event', title: 'Earthquake', text: 'The city is lost.' }
        ])
    })

    it('calls out nothing for a plain row', () => {
        expect(descriptionCallouts({ text: 'Bought a share' })).toEqual([])
    })
})
