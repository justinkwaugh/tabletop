import { describe, expect, it } from 'vitest'
import { ActionSource, type GameAction } from '@tabletop/common'
import { Presentation1846, steamboatTurnPrivateId } from './presentation.js'

describe('company prices', () => {
    it('shows no par, as shares sell at the current price (GMT rules, p. 19)', () => {
        expect(Presentation1846.companyPricePresentation?.showPar).toBe(false)
    })
})

describe('turn header', () => {
    const action = (type: string): GameAction => ({
        id: type,
        gameId: 'game',
        type,
        source: ActionSource.User
    })

    it('names the Steamboat Company while its owner assigns it, before any company operates', () => {
        expect(Presentation1846.turnPrivateId).toBe(steamboatTurnPrivateId)
        expect(steamboatTurnPrivateId({ machineState: 'AssigningSteamboat' })).toBe('SC')
        expect(steamboatTurnPrivateId({ machineState: 'LayingTrack' })).toBeUndefined()
    })

    it('names the Steamboat Company on the history step of its assignment', () => {
        expect(
            steamboatTurnPrivateId({ machineState: 'OperatingSet' }, action('AssignSteamboat'))
        ).toBe('SC')
        expect(
            steamboatTurnPrivateId({ machineState: 'OperatingSet' }, action('LayTile'))
        ).toBeUndefined()
    })
})
