import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import type { State1833NE } from '@tabletop/1833ne'
import { FerryArt, LuxuryFerryArt } from './ferryArt.js'
import { Presentation1833NE } from './presentation.js'

const scenario = (name: string): State1833NE =>
    JSON.parse(readFileSync(new URL(`../scenarios/${name}.json`, import.meta.url), 'utf8')).state

describe('the board as play leaves it', () => {
    const art = (state: State1833NE) => Presentation1833NE.markerArtFor?.(state) ?? {}

    it('keeps the first-round notes through the first operating round only', () => {
        const state = scenario('first-operating-round')
        expect(art(state).F23?.['first-round']).toBeUndefined()
        state.operatingSet = { ...state.operatingSet!, number: 2, roundNumber: 1 }
        expect(art(state).F23?.['first-round']).toEqual({ hidden: true })
        expect(art(state).G24?.['first-round']).toEqual({ hidden: true })
    })

    it('shows the Luxury Ferry Service on its ferry, and no ferries from phase IV', () => {
        const state = scenario('first-operating-round')
        state.ferries = [{ locationId: 'F27', companyId: 'B&P', luxury: true }]
        expect(art(state).F27?.ferry).toEqual({
            token: { imageUrl: LuxuryFerryArt.F27, place: 'corner' }
        })
        expect(art(state).C26?.ferry).toBeUndefined()
        state.phaseId = 'IV'
        expect(['C26', 'E26', 'F27', 'F25', 'G26'].map((id) => art(state)[id]?.ferry)).toEqual(
            Array(5).fill({ hidden: true })
        )
    })

    it('tabs the ferry the New/Last bonus marker sits by', () => {
        const state = scenario('first-operating-round')
        state.ferries = [{ locationId: 'F25', companyId: 'B&P' }]
        state.ferryBonus = { locationId: 'F25', side: 'new' }
        expect(art(state).F25?.ferry).toEqual({
            token: {
                imageUrl: FerryArt.F25,
                place: 'corner',
                tab: { label: '+20', caption: 'NEW', fill: '#231f20' }
            }
        })
        state.ferryBonus = { locationId: 'F25', side: 'last' }
        expect(art(state).F25?.ferry).toEqual({
            token: {
                imageUrl: FerryArt.F25,
                place: 'corner',
                tab: { label: '+10', caption: 'LAST', fill: '#4f4a45' }
            }
        })
    })

    it('marks a corporation’s card with its ferries and the bonus beside one', () => {
        const state = scenario('first-operating-round')
        state.ferries = [
            { locationId: 'F25', companyId: 'B&P' },
            { locationId: 'F27', companyId: 'B&P', luxury: true }
        ]
        state.ferryBonus = { locationId: 'F27', side: 'last' }
        const marks = Presentation1833NE.companyMarks?.(state, 'B&P') ?? []
        expect(marks.map((mark) => [mark.label, mark.imageUrl])).toEqual([
            ['Providence', FerryArt.F25],
            ['Stonington', LuxuryFerryArt.F27],
            ['+10 Last', undefined]
        ])
        expect(marks[1].description).toContain('$60')
        expect(Presentation1833NE.companyMarks?.({ ...state, phaseId: 'IV' }, 'B&P')).toEqual([])
    })

    it('calls a corporation’s private flipped from phase III', () => {
        const state = scenario('first-operating-round')
        expect(Presentation1833NE.privateStatus?.(state, 'P6')).toBeUndefined()
        expect(Presentation1833NE.privateStatus?.({ ...state, phaseId: 'III' }, 'P6')).toBe(
            'Flipped'
        )
    })
})
