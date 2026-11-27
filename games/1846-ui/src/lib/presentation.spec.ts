import { describe, expect, it } from 'vitest'
import { Presentation1846 } from './presentation.js'
import type { EighteenFortySixProjectedState } from '@tabletop/1846'

describe('company prices', () => {
    it('shows no par, as shares sell at the current price (GMT rules, p. 19)', () => {
        expect(Presentation1846.companyPricePresentation?.showPar).toBe(false)
    })
})

describe('turn header', () => {
    it('names the Steamboat Company while its owner assigns it, before any company operates', () => {
        const state = (machineState: string) =>
            ({ machineState }) as unknown as EighteenFortySixProjectedState
        expect(Presentation1846.turnPrivate?.(state('AssigningSteamboat'))).toBe('SC')
        expect(Presentation1846.turnPrivate?.(state('LayingTrack'))).toBeUndefined()
    })
})
