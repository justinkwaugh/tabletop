import { describe, expect, it } from 'vitest'
import { Color } from '@tabletop/common'
import { HydratedCampaign } from '../actions/campaign.js'
import { IMPERIAL_COLOR, PlayerStatus } from '../model/oathEnums.js'
import { CRADLE, HINTERLAND, PROVINCES, testPlayer, testState } from '../testing/fixture.js'
import { reasonNoCampaignAgainst } from './campaign.js'
import '../powers/index.js'

/** R-5.5.1, R-5.5.2 — a defender is legal only when some declaration of targets against them is. */
const ATT = 'att'
const DEF = 'def'
const CHAN = 'chan'
const CIT = 'cit'
const RED: Color = Color.Red
const BLUE: Color = Color.Blue
const HIDDEN_PLACE = 'site.the-hidden-place'
const PYTHON = 'denizen.beast.giant-python'

function board(over: Record<string, Record<string, unknown>> = {}, state: Record<string, unknown> = {}, cards: Record<string, string> = {}) {
    const identity = Object.fromEntries([...CRADLE, ...PROVINCES, ...HINTERLAND].map((slotId) => [slotId, slotId]))
    return testState(
        [
            testPlayer({ playerId: ATT, color: Color.Red, siteId: 'c1', secrets: 1, supply: 6, warbandsOnBoard: { [RED]: 4 }, ...over[ATT] }),
            testPlayer({ playerId: DEF, color: Color.Blue, siteId: 'p1', secrets: 1, supply: 6, warbandsOnBoard: { [BLUE]: 2 }, ...over[DEF] }),
            testPlayer({ playerId: CHAN, color: Color.Purple, status: PlayerStatus.Chancellor, siteId: 'c2', supply: 6, warbandsOnBoard: { [IMPERIAL_COLOR]: 3 }, ...over[CHAN] }),
            testPlayer({ playerId: CIT, color: Color.Yellow, status: PlayerStatus.Citizen, siteId: 'p2', supply: 6, warbandsOnBoard: { [IMPERIAL_COLOR]: 1 }, ...over[CIT] })
        ],
        { chancellorPlayerId: CHAN, warbandsBySite: { c1: { [BLUE]: 1 }, c2: { [IMPERIAL_COLOR]: 1 } }, siteCards: { ...identity, ...cards }, ...state }
    )
}

describe('a legal defender needs a legal declaration of targets (R-5.5.1, R-5.5.2)', () => {
    it('a defender ruling the attacker’s site is legal by that one target', () => {
        const s = board()
        expect(reasonNoCampaignAgainst(s, ATT, DEF)).toBeUndefined()
        expect(HydratedCampaign.legalDefenders(s, ATT)).toEqual([{ kind: 'player', playerId: DEF }])
        expect(HydratedCampaign.canDoCampaign(s, ATT)).toBe(true)
    })

    it('R-11.13 The Hidden Place: with no secret to flip, a site it makes mandatory cannot be targeted, so the defender is not legal', () => {
        const s = board({ [ATT]: { secrets: 0 } }, {}, { c1: HIDDEN_PLACE })
        expect(reasonNoCampaignAgainst(s, ATT, DEF)).toBe(`no targets can be declared against ${DEF}`)
        expect(HydratedCampaign.legalDefenders(s, ATT)).toEqual([])
        expect(HydratedCampaign.canDoCampaign(s, ATT)).toBe(false)
        const withSecret = board({}, {}, { c1: HIDDEN_PLACE })
        expect(reasonNoCampaignAgainst(withSecret, ATT, DEF)).toBeUndefined()
        expect(HydratedCampaign.legalDefenders(withSecret, ATT)).toEqual([{ kind: 'player', playerId: DEF }])
    })

    it('R-7.1.4 Giant Python: an odd lone target is no declaration, but a second target making the total even is', () => {
        const alone = board({ [DEF]: { advisers: [{ cardId: PYTHON, faceUp: true }] } })
        expect(reasonNoCampaignAgainst(alone, ATT, DEF)).toBe(`no targets can be declared against ${DEF}`)
        expect(HydratedCampaign.legalDefenders(alone, ATT)).toEqual([])
        const twoSites = board({ [DEF]: { advisers: [{ cardId: PYTHON, faceUp: true }] } }, { warbandsBySite: { c1: { [BLUE]: 1 }, c2: { [IMPERIAL_COLOR]: 1 }, h1: { [BLUE]: 1 } } })
        expect(reasonNoCampaignAgainst(twoSites, ATT, DEF)).toBeUndefined()
        expect(HydratedCampaign.legalDefenders(twoSites, ATT)).toEqual([{ kind: 'player', playerId: DEF }])
    })

    it('R-5.5.1.a: the Chancellor may choose a Citizen who rules his site by purple, but suspended the Citizen rules nothing there', () => {
        const s = board({ [DEF]: { siteId: 'h3' } }, { warbandsBySite: { c2: { [IMPERIAL_COLOR]: 1 } } })
        expect(reasonNoCampaignAgainst(s, CHAN, CIT)).toBe(`no targets can be declared against ${CIT}`)
        expect(HydratedCampaign.legalDefenders(s, CHAN)).toEqual([])
        const pawnThere = board({ [DEF]: { siteId: 'h3' }, [CIT]: { siteId: 'c2' } }, { warbandsBySite: { c2: { [IMPERIAL_COLOR]: 1 } } })
        expect(reasonNoCampaignAgainst(pawnThere, CHAN, CIT)).toBeUndefined()
        expect(HydratedCampaign.legalDefenders(pawnThere, CHAN)).toEqual([{ kind: 'player', playerId: CIT }])
    })

    it('a defender who may not be chosen at all is refused for that reason first', () => {
        const s = board({ [DEF]: { siteId: 'p1' } }, { warbandsBySite: {} })
        expect(reasonNoCampaignAgainst(s, ATT, DEF)).toBe(`${DEF} neither rules your site nor has a pawn there`)
        expect(HydratedCampaign.legalDefenders(s, ATT)).toEqual([{ kind: 'bandits' }])
    })
})
