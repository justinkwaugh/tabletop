import { describe, expect, it } from 'vitest'
import { messageSegments } from './messageSegments.js'

const markup = { options: {}, attributes: {} }

describe('messageSegments', () => {
    it('gathers the text inside a markup pair into one segment', () => {
        expect(
            messageSegments([
                { type: 'text', value: 'Type your username, ' },
                { type: 'markup-start', name: 'username', ...markup },
                { type: 'text', value: 'bob' },
                { type: 'markup-end', name: 'username', ...markup },
                { type: 'text', value: ', to confirm' }
            ])
        ).toEqual([
            { type: 'text', text: 'Type your username, ' },
            { type: 'markup', name: 'username', text: 'bob' },
            { type: 'text', text: ', to confirm' }
        ])
    })

    it('keeps standalone markup as an empty segment', () => {
        expect(
            messageSegments([
                { type: 'text', value: 'press ' },
                { type: 'markup-standalone', name: 'bookmark', ...markup },
                { type: 'text', value: ' in the top bar' }
            ])
        ).toEqual([
            { type: 'text', text: 'press ' },
            { type: 'markup', name: 'bookmark', text: '' },
            { type: 'text', text: ' in the top bar' }
        ])
    })

    it('rejects markup that is never closed', () => {
        expect(() =>
            messageSegments([{ type: 'markup-start', name: 'username', ...markup }])
        ).toThrow('never closed')
    })
})
