import { describe, expect, it } from 'vitest'
import { Banner, PlayerStatus } from '../model/oathEnums.js'
import { testBanners, testPlayer, testState } from '../testing/fixture.js'
import { reasonTermsInvalid } from '../actions/offerCitizenship.js'
import { reasonExchangeInvalid, reasonTransferInvalid } from './exchange.js'

// R-10.8, R-6.6.1
function board() {
    return testState(
        [
            testPlayer({ playerId: 'chan', status: PlayerStatus.Chancellor, favor: 2, secrets: 1, relicIds: ['relic.cup-of-plenty'] }),
            testPlayer({ playerId: 'ex', favor: 1, secrets: 0 })
        ],
        { chancellorPlayerId: 'chan', banners: testBanners({ [Banner.PeoplesFavor]: 'chan' }) }
    )
}

describe('one transfer validator for exchanges and Citizenship terms', () => {
    it('refuses the same over-promise with the same words from either route', () => {
        const s = board()
        const expected = 'chan promised 3 favor but has 2'
        expect(reasonTermsInvalid(s, 'chan', 'ex', { fromScepterHolder: { favor: 3 } })).toBe(expected)
        expect(reasonExchangeInvalid(s, 'chan', 'ex', { fromProposer: { favor: 3 } })).toBe(expected)
        expect(reasonTermsInvalid(s, 'chan', 'ex', { fromExile: { relicCardIds: ['relic.cup-of-plenty'] } })).toBe('ex promised relic.cup-of-plenty, which they do not hold')
        expect(reasonExchangeInvalid(s, 'ex', 'chan', { fromProposer: { relicCardIds: ['relic.cup-of-plenty'] } })).toBe('ex promised relic.cup-of-plenty, which they do not hold')
    })

    it('refuses a fraction and a negative amount on both routes', () => {
        const s = board()
        expect(reasonTermsInvalid(s, 'chan', 'ex', { fromScepterHolder: { favor: 0.5 } })).toBe('a promised amount cannot be negative')
        expect(reasonExchangeInvalid(s, 'chan', 'ex', { fromProposer: { secrets: -1 } })).toBe('a promised amount cannot be negative')
    })

    it('checks a promised banner is held, and accepts what the promiser has', () => {
        const s = board()
        expect(reasonTransferInvalid(s, 'ex', 'chan', { banners: [Banner.PeoplesFavor] })).toBe('ex promised the peoplesFavor, which they do not hold')
        expect(reasonTransferInvalid(s, 'chan', 'ex', { favor: 2, secrets: 1, relicCardIds: ['relic.cup-of-plenty'], banners: [Banner.PeoplesFavor] })).toBeUndefined()
    })

    it('refuses the same relic or banner promised twice', () => {
        const s = board()
        expect(reasonTermsInvalid(s, 'chan', 'ex', { fromScepterHolder: { relicCardIds: ['relic.cup-of-plenty', 'relic.cup-of-plenty'] } })).toBe('chan promised the same relic twice')
        expect(reasonTermsInvalid(s, 'chan', 'ex', { fromScepterHolder: { banners: [Banner.PeoplesFavor, Banner.PeoplesFavor] } })).toBe('chan promised the same banner twice')
        expect(reasonExchangeInvalid(s, 'chan', 'ex', { fromProposer: { relicCardIds: ['relic.cup-of-plenty', 'relic.cup-of-plenty'] } })).toBe('chan promised the same relic twice')
    })
})
