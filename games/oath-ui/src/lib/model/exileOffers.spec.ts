import { describe, expect, it } from 'vitest'
import { Color } from '@tabletop/common'
import { ActionType, Banner, IMPERIAL_WARBANDS, PlayerStatus } from '@tabletop/oath'
import { testBanners, testPlayer, testState } from '@tabletop/oath/testing'
import { exileCitizenOffers, selfExileOffer } from './exileOffers.js'
import {
    MINOR_TARGETED_ACTIONS,
    UNTARGETED_ACTIONS,
    actionName
} from './actionCatalogue.js'

const CHANCELLOR = 'chan'

function board(citizenFavor = 10) {
    return testState(
        [
            testPlayer({
                playerId: CHANCELLOR,
                color: Color.Purple,
                status: PlayerStatus.Chancellor,
                siteId: 'c1',
                favor: 12,
                relicIds: ['relic.grand-scepter'],
                warbandsInPersonalBank: { [IMPERIAL_WARBANDS]: 18 }
            }),
            testPlayer({
                playerId: 'cole',
                color: Color.Red,
                status: PlayerStatus.Citizen,
                siteId: 'c1',
                favor: citizenFavor,
                secrets: 1,
                warbandsOnBoard: { [IMPERIAL_WARBANDS]: 2 },
                warbandsInPersonalBank: { cole: 14 }
            }),
            testPlayer({
                playerId: 'ann',
                color: Color.Blue,
                status: PlayerStatus.Citizen,
                siteId: 'c2',
                favor: 4,
                warbandsInPersonalBank: { ann: 14 }
            })
        ],
        { chancellorPlayerId: CHANCELLOR, banners: testBanners({ [Banner.PeoplesFavor]: 'ann' }) }
    )
}

describe('the price on each exile button (R-6.7, R-6.8)', () => {
    it('R-6.7 — each Citizen the holder may exile, with the favor it gives them: one more for the People’s Favor', () => {
        expect(exileCitizenOffers(board(), CHANCELLOR)).toEqual([
            { citizenPlayerId: 'cole', favor: 5 },
            { citizenPlayerId: 'ann', favor: 6 }
        ])
    })

    it('R-6.7 — offers no Citizen to a player without the Grand Scepter', () => {
        expect(exileCitizenOffers(board(), 'cole')).toEqual([])
    })

    it('R-6.8 — exiling yourself gives the Grand Scepter’s holder one favor per secret and board warband', () => {
        expect(selfExileOffer(board(), 'cole')).toEqual({ favor: 3, holderId: CHANCELLOR })
    })

    it('R-6.8 — offers no price to a player who cannot pay it, or holds the Scepter', () => {
        expect(selfExileOffer(board(2), 'cole')).toBeUndefined()
        expect(selfExileOffer(board(), CHANCELLOR)).toBeUndefined()
    })

    it('exiling yourself is staged like the other minors, not sent on the tap', () => {
        expect(UNTARGETED_ACTIONS.has(ActionType.SelfExile)).toBe(false)
        expect(MINOR_TARGETED_ACTIONS.has(ActionType.SelfExile)).toBe(true)
        expect(actionName(ActionType.SelfExile)).toBe('Exile yourself')
    })
})
