import { describe, expect, it } from 'vitest'
import { Color } from '@tabletop/common'
import { HydratedCampaign, Campaign } from '../actions/campaign.js'
import { HydratedTravel } from '../actions/travel.js'
import { HydratedRecover, RecoverTargetKind, Recover } from '../actions/recover.js'
import { Banner, Suit } from '../model/oathEnums.js'
import { CampaignTargetKind } from '../model/campaign.js'
import { testPlayer, testState, openTurn } from '../testing/fixture.js'
import { burnFavor } from '../util/burn.js'
import '../powers/index.js'
import { buildAction } from '../testing/actions.js'
import { battlePlanUse, modifierUse } from '../testing/choices.js'

const LONGBOWS = 'denizen.order.longbows'
const VOW_OF_UNION = 'denizen.beast.vow-of-union'
const VOW_OF_RENEWAL = 'denizen.discord.vow-of-renewal'
const MAGICIANS_CODE = 'denizen.arcane.magicians-code'

function board(advisers: string[] = [], over: Record<string, Record<string, unknown>> = {}, state: Record<string, unknown> = {}) {
    const s = testState(
        [
            testPlayer({ playerId: 'att', color: Color.Red, siteId: 'c1', favor: 4, secrets: 3, supply: 6, warbandsOnBoard: { [Color.Red]: 3 }, warbandsInPersonalBank: { [Color.Red]: 6 }, advisers: advisers.map((cardId) => ({ cardId, faceUp: true })), ...over['att'] }),
            testPlayer({ playerId: 'def', color: Color.Blue, siteId: 'c1', favor: 3, secrets: 2, supply: 4, warbandsOnBoard: { [Color.Blue]: 2 }, warbandsInPersonalBank: { [Color.Blue]: 5 }, ...over['def'] })
        ],
        {
            denizensBySite: { c1: [], c2: [], p1: [], h1: [] },
            warbandsBySite: { c1: { [Color.Blue]: 2 }, c2: { [Color.Red]: 2 }, p1: { [Color.Blue]: 3 } },
            siteCards: { c1: 'site.plains', c2: 'site.river', p1: 'site.marshes', h1: 'site.mountain' },
            ...state
        }
    )
    openTurn(s, 'att')
    return s
}
const campaignChoice = (attackDice: number, plans?: { cardId: string; powerIndex: number }[]) => ({
    defender: { kind: 'player' as const, playerId: 'def' }, targets: [{ kind: CampaignTargetKind.Site as const, siteId: 'c1' }], attackDice, plans
})

describe('Longbows — ± one attack die by side', () => {
    it('adds one for the attacker', () => {
        const s = board([LONGBOWS])
        const a = new HydratedCampaign(buildAction(Campaign, { playerId: 'att', ...campaignChoice(2, [battlePlanUse(LONGBOWS)]) }))
        a.apply(s)
        // R-11.4 — two declared, one from Longbows, one from the Plains.
        expect(a.metadata?.battle?.attackPool).toBe(4)
        const bare = board([LONGBOWS])
        new HydratedCampaign(buildAction(Campaign, { playerId: 'att', ...campaignChoice(2) })).apply(bare)
        expect(bare.campaign?.attackPool).toBe(3)
    })
})

describe('Vow of Union — the ruled sites in the force, and no leaving a ruled site with a board', () => {
    it('the dice cap counts the warbands at every ruled site, and the Campaign records them', () => {
        const s = board([VOW_OF_UNION])
        // Board 3 + c2's 2 red = 5 dice; c1 is blue's.
        expect(HydratedCampaign.reasonCannotCampaign(s, 'att', campaignChoice(5))).toBeUndefined()
        expect(HydratedCampaign.reasonCannotCampaign(s, 'att', campaignChoice(6))).toMatch(/at most 5/)
        const a = new HydratedCampaign(buildAction(Campaign, { playerId: 'att', ...campaignChoice(5) }))
        a.apply(s)
        expect(s.campaign?.forceSiteIds).toEqual(['c2'])
        expect(HydratedCampaign.reasonCannotCampaign(board(), 'att', campaignChoice(4))).toMatch(/at most 3/)
    })

    it('forbids travelling from a ruled site while warbands are on the board, and not otherwise', () => {
        const s = board([VOW_OF_UNION], {}, { warbandsBySite: { c1: { [Color.Red]: 1, [Color.Blue]: 2 }, c2: { [Color.Red]: 2 }, p1: { [Color.Blue]: 3 } } })
        expect(HydratedTravel.reasonCannotTravel(s, 'att', 'c2')).toMatch(/cannot travel from a site you rule/)
        s.getPlayerState('att').warbandsOnBoard = {}
        expect(HydratedTravel.reasonCannotTravel(s, 'att', 'c2')).toBeUndefined()
        const t = board([VOW_OF_UNION])
        expect(HydratedTravel.reasonCannotTravel(t, 'att', 'c2')).toBeUndefined()
        const u = board([], { def: { advisers: [{ cardId: VOW_OF_UNION, faceUp: true }] } }, { warbandsBySite: { c1: { [Color.Red]: 1, [Color.Blue]: 2 }, c2: { [Color.Red]: 2 }, p1: { [Color.Blue]: 3 } } })
        expect(HydratedTravel.reasonCannotTravel(u, 'att', 'c2')).toBeUndefined()
    })
})

describe("Vow of Renewal — burned favor is the holder's, and the People's Favor is off limits", () => {
    it('every burn lands on the holder; without the vow it goes to the supply', () => {
        const s = board([], { def: { advisers: [{ cardId: VOW_OF_RENEWAL, faceUp: true }] } })
        const supply = s.favorSupply
        expect(burnFavor(s, 2)).toBe('def')
        expect(s.getPlayerState('def').favor).toBe(5)
        expect(s.favorSupply).toBe(supply)
        const t = board()
        expect(burnFavor(t, 2)).toBeUndefined()
        expect(t.favorSupply).toBe(supply + 2)
    })

    it("its holder cannot recover the People's Favor; anyone else can", () => {
        const s = board([], { def: { advisers: [{ cardId: VOW_OF_RENEWAL, faceUp: true }], favor: 5 } }, { banners: { [Banner.PeoplesFavor]: { value: 1 }, [Banner.DarkestSecret]: { value: 1 } } })
        const choice = { target: { kind: RecoverTargetKind.Banner as const, banner: Banner.PeoplesFavor }, amountPaid: 2, redistributeFrom: Suit.Discord }
        expect(HydratedRecover.reasonCannotRecover(s, 'def', choice)).toMatch(/Vow of Renewal/)
        expect(HydratedRecover.reasonCannotRecover(s, 'att', choice)).toBeUndefined()
    })
})

describe("Magician's Code — two free secrets on the Darkest Secret", () => {
    it('stacks two more than paid, so even nothing paid beats a value of one; refused for the People\'s Favor', () => {
        const s = board([MAGICIANS_CODE], { att: { secrets: 0, favor: 4 } }, { banners: { [Banner.PeoplesFavor]: { value: 1 }, [Banner.DarkestSecret]: { value: 1 } } })
        const mod = [modifierUse(MAGICIANS_CODE)]
        const dark = { target: { kind: RecoverTargetKind.Banner as const, banner: Banner.DarkestSecret } }
        expect(HydratedRecover.reasonCannotRecover(s, 'att', { ...dark, amountPaid: 0 })).toMatch(/must pay more/)
        expect(HydratedRecover.reasonCannotRecover(s, 'att', { ...dark, amountPaid: 0, modifiers: mod })).toBeUndefined()
        expect(HydratedRecover.reasonCannotRecover(s, 'att', { target: { kind: RecoverTargetKind.Banner as const, banner: Banner.PeoplesFavor }, amountPaid: 2, redistributeFrom: Suit.Discord, modifiers: mod })).toMatch(/only when recovering the Darkest Secret/)
        const r = new HydratedRecover(buildAction(Recover, { playerId: 'att', ...dark, amountPaid: 0, modifiers: mod }))
        r.apply(s)
        expect(s.banners[Banner.DarkestSecret]).toMatchObject({ holderPlayerId: 'att', value: 2 })
        // Two favor placed on the card; the old secret goes to the recoverer.
        expect(s.cardTokens[MAGICIANS_CODE]).toEqual({ favor: 2, secrets: 0 })
        expect(s.getPlayerState('att')).toMatchObject({ favor: 2, secrets: 1 })
    })
})
