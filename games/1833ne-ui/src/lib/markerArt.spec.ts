import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import type { State1833NE } from '@tabletop/1833ne'
import { LuxuryFerryArt } from './ferryArt.js'
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
})
