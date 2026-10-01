import { describe, expect, it } from 'vitest'
import { Color } from '@tabletop/common'
import { HydratedCampaign, Campaign } from '../actions/campaign.js'
import { HydratedMuster, Muster } from '../actions/muster.js'
import { SearchPlay } from '../actions/searchResolve.js'
import { playCard } from './cardPlay.js'
import { CampaignTargetKind, type CampaignTarget } from '../model/campaign.js'
import { PlayerStatus, Region, Suit } from '../model/oathEnums.js'
import { testPlayer, testState, openTurn } from '../testing/fixture.js'
import { discardEachFromPlay, homelandLedgerKey } from './discard.js'
import '../powers/index.js'
import { buildAction } from '../testing/actions.js'
import { siteTarget } from '../testing/choices.js'
import { INN } from '../testing/cards.js'

const AUGURY = 'denizen.arcane.augury'
const RETURN = 'denizen.hearth.awaited-return'

function board(c1Card: string, over: Record<string, unknown> = {}, ruler: Record<string, unknown> = {}) {
    const s = testState(
        [
            testPlayer({
                playerId: 'ruler',
                color: Color.Red,
                status: PlayerStatus.Exile,
                siteId: 'c1',
                favor: 3,
                secrets: 1,
                supply: 5,
                warbandsOnBoard: { ruler: 4 },
                warbandsInPersonalBank: { ruler: 5 },
                ...ruler
            }),
            testPlayer({
                playerId: 'other',
                color: Color.Blue,
                status: PlayerStatus.Exile,
                siteId: 'c1',
                warbandsOnBoard: { other: 3 },
                warbandsInPersonalBank: { other: 5 }
            })
        ],
        {
            denizensBySite: { c1: [INN], c2: [], p1: [] },
            warbandsBySite: { c1: { ruler: 1 }, p1: { other: 2 }, c2: { other: 1 } },
            siteCards: { c1: c1Card, c2: 'site.plains', p1: 'site.mountain', p2: 'site.river' },
            prng: { seed: 3, invocations: 0 },
            ...over
        }
    )
    openTurn(s, 'ruler')
    return s
}

// R-5.5.2 — at least one target at the attacker's site: the defender's pawn is there.
const pawn: CampaignTarget = { kind: CampaignTargetKind.PawnAndFavor }

function campaign(targets: CampaignTarget[], attackDice: number) {
    return new HydratedCampaign(
        buildAction(Campaign, {
            playerId: 'ruler',
            defender: { kind: 'player', playerId: 'other' },
            targets: [...targets, pawn],
            attackDice,
        })
    )
}

describe('R-11.4 — Plains and Mountain', () => {
    it('Plains adds one attack die per targeted Plains; Mountain removes one', () => {
        const plains = board('site.mine')
        const a = campaign([siteTarget('c2')], 2)
        a.apply(plains)
        expect(a.metadata?.battle?.attackPool).toBe(3)
        expect(a.metadata?.battle?.siteDice).toEqual([{ siteId: 'c2', attack: 1 }])

        const mountain = board('site.mine')
        const b = campaign([siteTarget('p1')], 2)
        b.apply(mountain)
        expect(b.metadata?.battle?.attackPool).toBe(1)
        expect(b.metadata?.battle?.siteDice).toEqual([{ siteId: 'p1', attack: -1 }])
    })

    it('"any number of targets at this site": the defender\'s pawn at a Plains counts, with no site targeted', () => {
        const s = board('site.plains')
        const a = campaign([], 2)
        a.apply(s)
        expect(a.metadata?.battle?.siteDice).toEqual([{ siteId: 'c1', attack: 1 }])
        expect(a.metadata?.battle?.attackPool).toBe(3)
    })

    it('Mountain with no attack dice to pay underflows into a defense die (R-5.5.3)', () => {
        const neutral = board('site.mine', { siteCards: { c1: 'site.mine', c2: 'site.plains', p1: 'site.salt-flats' } })
        const n = campaign([siteTarget('p1')], 0)
        n.apply(neutral)
        const s = board('site.mine')
        const a = campaign([siteTarget('p1')], 0)
        a.apply(s)
        expect(a.metadata?.battle?.attackPool).toBe(0)
        expect(a.metadata?.battle?.defensePool).toBe((n.metadata?.battle?.defensePool ?? 0) + 1)
    })

    it('a site whose card is neither leaves the pools alone', () => {
        const s = board('site.mine', { siteCards: { c1: 'site.mine', c2: 'site.marshes', p1: 'site.salt-flats' } })
        const a = campaign([siteTarget('c2')], 2)
        a.apply(s)
        expect(a.metadata?.battle?.attackPool).toBe(2)
        expect(a.metadata?.battle?.siteDice).toBeUndefined()
    })
})

describe('R-11.5 — River', () => {
    it('one more warband when mustering here and ruling here; not when unruled', () => {
        const ruled = board('site.river')
        new HydratedMuster(buildAction(Muster, { playerId: 'ruler', cardId: INN })).apply(ruled)
        expect(ruled.getPlayerState('ruler').warbandsOnBoard['ruler']).toBe(4 + 3)

        const unruled = board('site.river', { warbandsBySite: { c1: { other: 1 }, p1: { other: 2 } } })
        new HydratedMuster(buildAction(Muster, { playerId: 'ruler', cardId: INN })).apply(unruled)
        expect(unruled.getPlayerState('ruler').warbandsOnBoard['ruler']).toBe(4 + 2)

        const elsewhere = board('site.mine')
        new HydratedMuster(buildAction(Muster, { playerId: 'ruler', cardId: INN })).apply(elsewhere)
        expect(elsewhere.getPlayerState('ruler').warbandsOnBoard['ruler']).toBe(4 + 2)
    })
})

describe('R-11.2 — Homelands', () => {
    it('Fertile Valley pays a hearth favor on a hearth play, on top of R-5.1.4.I', () => {
        const s = board('site.fertile-valley')
        const bank = s.favorBank[Suit.Hearth]
        const played = playCard(s, 'ruler', RETURN, SearchPlay.Site, Region.Cradle)
        expect(played.favorGained).toBe(1)
        expect(played.sitePower).toMatch(/Fertile Valley/)
        expect(s.getPlayerState('ruler').favor).toBe(3 + 2)
        expect(s.favorBank[Suit.Hearth]).toBe(bank - 2)
    })

    it('Standing Stones pays a secret on an arcane play, and nothing on a hearth play', () => {
        const s = board('site.standing-stones')
        expect(playCard(s, 'ruler', AUGURY, SearchPlay.Site, Region.Cradle).sitePower).toMatch(/secret/)
        expect(s.getPlayerState('ruler').secrets).toBe(2)
        const t = board('site.standing-stones')
        expect(playCard(t, 'ruler', RETURN, SearchPlay.Site, Region.Cradle).sitePower).toBeUndefined()
        expect(t.getPlayerState('ruler').secrets).toBe(1)
    })

    it('a same-suit discard here this turn (the ledger) forfeits the gain', () => {
        const s = board('site.fertile-valley', {}, { homelandUsedThisTurn: [homelandLedgerKey('c1', Suit.Hearth)] })
        const played = playCard(s, 'ruler', RETURN, SearchPlay.Site, Region.Cradle)
        expect(played.sitePower).toMatch(/no Homeland gain/)
        expect(s.getPlayerState('ruler').favor).toBe(4)
    })

    it('R-11.2 — discarding a hearth card from the site this turn writes the ledger, so the next hearth play there gains nothing', () => {
        const s = board('site.fertile-valley')
        s.denizensBySite.c1 = ['denizen.hearth.wayside-inn']
        discardEachFromPlay(s, 'ruler', ['denizen.hearth.wayside-inn'])
        expect(s.getPlayerState('ruler').homelandUsedThisTurn).toEqual([homelandLedgerKey('c1', Suit.Hearth)])
        expect(playCard(s, 'ruler', RETURN, SearchPlay.Site, Region.Cradle).sitePower).toMatch(/no Homeland gain/)
    })

    it('an adviser play pays nothing (the Homeland is the site)', () => {
        const s = board('site.fertile-valley')
        expect(playCard(s, 'ruler', RETURN, SearchPlay.Adviser, Region.Cradle, { faceUp: true }).sitePower).toBeUndefined()
        expect(s.getPlayerState('ruler').favor).toBe(3)
    })
})
