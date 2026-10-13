import { describe, expect, it } from 'vitest'
import { AUSTERLITZ } from '@tabletop/napoleons-triumph'
import { standingAt } from './standing.js'

describe('where a piece stands, in words', () => {
    it('names the locale and says it is in reserve', () => {
        expect(standingAt(AUSTERLITZ, { locale: 53 })).toEqual({
            place: 'Zuran Berg',
            stance: 'in reserve'
        })
    })

    it('names the locale an approach looks into', () => {
        const [approach] = AUSTERLITZ.passableApproachesOf(64)
        expect(standingAt(AUSTERLITZ, { locale: 64, approach: approach.id })).toEqual({
            place: 'locale 64',
            stance: `facing ${AUSTERLITZ.label(approach.neighbour)}`
        })
    })
})
