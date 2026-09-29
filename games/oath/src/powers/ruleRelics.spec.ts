import { describe, expect, it } from 'vitest'
import { assertExists, Color } from '@tabletop/common'
import { HydratedCampaign, type CampaignDefender, Campaign } from '../actions/campaign.js'
import { HydratedCampaignDefend, CampaignDefend } from '../actions/campaignDefend.js'
import { HydratedCampaignSacrifice, CampaignSacrifice } from '../actions/campaignSacrifice.js'
import { HydratedCampaignResolveVictory, CampaignResolveVictory } from '../actions/campaignResolveVictory.js'
import { HydratedMoveWarbands, MoveWarbands } from '../actions/moveWarbands.js'
import { WarbandMoveKind } from '../model/warbandMove.js'
import { HydratedUseActionPower, UseActionPower } from '../actions/useActionPower.js'
import { type CampaignTarget } from '../model/campaign.js'
import { IMPERIAL_COLOR, OathType, PlayerStatus, Suit } from '../model/oathEnums.js'
import { cardPowers, PowerTiming, BattlePlanSide, powerIndexOf } from '../data/cardPowers.js'
import { defenseShieldsFromFaces } from '../data/dice.js'
import { testPlayer, testState, openTurn } from '../testing/fixture.js'
import { accessibleCardIds, hasAccessToCard, ruledFaceupCardIds, rulesCard } from '../util/access.js'
import { mayUseBattlePlansOf, usableBattlePlans } from '../util/battlePlans.js'
import { legalPowers } from '../util/powerDoorway.js'
import { PowerChoiceKind } from '../util/powerChoice.js'
import { persistentsInPlay } from '../util/persistent.js'
import { playersMeetingOathkeeperGoal, sitesRuledCount } from '../util/oathkeeper.js'
import { banditsRuleSite, banditsServe, rulersOfSite, rulesSite, sitesRuledBy, warbandsAt } from '../util/rule.js'
import { hasEffect } from './registry.js'
import { ruledCardsOfSuit } from './vocabulary.js'
import '../powers/index.js'
import { buildAction } from '../testing/actions.js'
import { siteTarget } from '../testing/choices.js'

const CROWN = 'relic.bandit-crown'
const MASK = 'relic.grand-mask'
const MESSENGER = 'denizen.order.messenger'
const LONGBOWS = 'denizen.order.longbows'
const BANDIT_CHIEF = 'denizen.discord.bandit-chief'
const VOW_OF_UNION = 'denizen.beast.vow-of-union'

const ME = 'me'
const RED: Color = Color.Red
const FOE = 'foe'
const CHAN = 'chan'
const CIT = 'cit'

/** Every site but c1, h1 and p1 is faceup and holds no warbands. */
function board(
    relics: Partial<Record<string, string[]>>,
    over: Record<string, Record<string, unknown>> = {},
    state: Record<string, unknown> = {},
    turn = ME
) {
    const s = testState(
        [
            testPlayer({ playerId: ME, color: Color.Red, siteId: 'c1', favor: 4, secrets: 2, supply: 6, relicIds: relics[ME] ?? [], warbandsOnBoard: { [Color.Red]: 4 }, warbandsInPersonalBank: { [Color.Red]: 6 }, ...over[ME] }),
            testPlayer({ playerId: FOE, color: Color.Blue, siteId: 'h1', favor: 4, secrets: 2, supply: 6, relicIds: relics[FOE] ?? [], warbandsOnBoard: { [Color.Blue]: 5 }, warbandsInPersonalBank: { [Color.Blue]: 5 }, ...over[FOE] }),
            testPlayer({ playerId: CHAN, color: Color.Purple, status: PlayerStatus.Chancellor, siteId: 'p1', favor: 4, secrets: 2, supply: 6, relicIds: relics[CHAN] ?? [], warbandsOnBoard: { [IMPERIAL_COLOR]: 3 }, warbandsInPersonalBank: { [IMPERIAL_COLOR]: 8 }, ...over[CHAN] }),
            testPlayer({ playerId: CIT, color: Color.Yellow, status: PlayerStatus.Citizen, siteId: 'p1', favor: 4, secrets: 2, supply: 6, relicIds: relics[CIT] ?? [], warbandsInPersonalBank: { [Color.Yellow]: 14 }, ...over[CIT] })
        ],
        {
            chancellorPlayerId: CHAN,
            denizensBySite: { c1: [], c2: [MESSENGER, LONGBOWS], p1: [], h1: [] },
            warbandsBySite: { c1: { [Color.Red]: 1 }, h1: { [Color.Blue]: 3 }, p1: { [IMPERIAL_COLOR]: 2 } },
            ...state
        }
    )
    openTurn(s, turn)
    s.activePlayerIds = [turn]
    return s
}

const EMPTY_SITES = ['c2', 'p2', 'p3', 'h2', 'h3']

function campaignBy(attackerId: string, defender: CampaignDefender, targets: CampaignTarget[], attackDice: number) {
    return new HydratedCampaign(buildAction(Campaign, { playerId: attackerId, defender, targets, attackDice }))
}
function defendWithNothing(s: ReturnType<typeof board>) {
    while (s.campaign?.pendingDefenderPlans) {
        const playerId = s.campaign.pendingDefenderPlans.queue[0]
        assertExists(playerId, 'the battle-plan step is open with nobody to answer it')
        new HydratedCampaignDefend(buildAction(CampaignDefend, { playerId, plans: [] })).apply(s)
    }
}
function choiceOf(defender: CampaignDefender, targets: CampaignTarget[], attackDice = 1) {
    return { defender, targets, attackDice }
}
/** Searches seeds for one on which foe's attack on `me` at `at` wins with no sacrifice. */
function foeBeatsMeAt(at: string, build: (seed: number) => ReturnType<typeof board>) {
    for (let seed = 1; seed < 60; seed++) {
        const s = build(seed)
        campaignBy(FOE, { kind: 'player', playerId: ME }, [siteTarget(at)], 5).apply(s)
        defendWithNothing(s)
        if (s.campaign && s.campaign.swords > s.campaign.defense) return s
    }
    throw new Error('no seed gave the attacker the victory')
}

describe('Bandit Crown — registered', () => {
    it('both relics carry a built persistent power, in play for their holder alone', () => {
        for (const relic of [CROWN, MASK]) {
            expect(cardPowers(relic).map((p) => p.timing)).toEqual([PowerTiming.Persistent])
            expect(hasEffect(cardPowers(relic)[0])).toBe(true)
            const inPlay = persistentsInPlay(board({ [ME]: [relic] })).filter((p) => p.ctx.cardId === relic)
            expect(inPlay.map((p) => p.ctx.ownerIds)).toEqual([[ME]])
        }
    })
})

describe('Bandit Crown — "Act as if bandits are your warbands … (You rule empty sites.)"', () => {
    it('you rule empty sites: every faceup site holding no warbands, and nobody else does', () => {
        const s = board({ [ME]: [CROWN] })
        for (const siteId of EMPTY_SITES) {
            expect(rulesSite(s, ME, siteId), siteId).toBe(true)
            expect(rulersOfSite(s, siteId), siteId).toEqual([ME])
        }
        expect(sitesRuledBy(s, ME).sort()).toEqual(['c1', ...EMPTY_SITES].sort())
        expect(sitesRuledBy(board({}), ME)).toEqual(['c1'])
    })

    it('a facedown site is ruled by nobody, Crown or not (R-10.21)', () => {
        const s = board({ [ME]: [CROWN] }, {}, { siteCards: { c1: 'c1', p1: 'p1', h1: 'h1' } })
        expect(rulesSite(s, ME, 'c2')).toBe(false)
        expect(banditsServe(s, ME, 'c2')).toBe(false)
    })

    it('the bandits rule nothing the holder rules: they cannot be chosen as a defender there', () => {
        const s = board({ [ME]: [CROWN] }, { [FOE]: { siteId: 'c2' } })
        expect(banditsRuleSite(s, 'c2')).toBe(false)
        expect(HydratedCampaign.reasonCannotCampaign(s, FOE, choiceOf({ kind: 'bandits' }, [siteTarget('c2')]))).toMatch(/bandits cannot be chosen/)
        const bare = board({}, { [FOE]: { siteId: 'c2' } })
        expect(banditsRuleSite(bare, 'c2')).toBe(true)
        expect(HydratedCampaign.reasonCannotCampaign(bare, FOE, choiceOf({ kind: 'bandits' }, [siteTarget('c2')]))).toBeUndefined()
    })

    it('access: the cards at an empty site are in reach from anywhere, and their Action powers are offered', () => {
        const s = board({ [ME]: [CROWN] })
        expect(rulesCard(s, ME, MESSENGER)).toBe(true)
        expect(accessibleCardIds(s, ME)).toEqual(expect.arrayContaining([MESSENGER, LONGBOWS]))
        expect(legalPowers(s, ME, PowerTiming.Action).map((p) => p.cardId)).toContain(MESSENGER)
        expect(accessibleCardIds(board({}), ME)).not.toContain(MESSENGER)
        expect(accessibleCardIds(s, FOE)).not.toContain(MESSENGER)
    })

    it('battle plans: the holder may use the plans at an empty site (R-7.5.1)', () => {
        const s = board({ [ME]: [CROWN] })
        expect(mayUseBattlePlansOf(s, ME, LONGBOWS)).toBe(true)
        expect(usableBattlePlans(s, ME, BattlePlanSide.Defender).map((p) => p.cardId)).toContain(LONGBOWS)
        expect(mayUseBattlePlansOf(board({}), ME, LONGBOWS)).toBe(false)
    })

    it('Campaign targets: the holder is the defender of an empty site, from anywhere on the map (R-5.5.2)', () => {
        const s = board({ [ME]: [CROWN] }, { [FOE]: { siteId: 'c2' } })
        expect(HydratedCampaign.reasonCannotCampaign(s, FOE, choiceOf({ kind: 'player', playerId: ME }, [siteTarget('c2'), siteTarget('p3')]))).toBeUndefined()
        // me rules foe's site, c2, so it must be among the targets.
        expect(HydratedCampaign.reasonCannotCampaign(s, FOE, choiceOf({ kind: 'player', playerId: ME }, [siteTarget('p3')]))).toMatch(/must/)
        expect(HydratedCampaign.reasonCannotCampaign(board({}, { [FOE]: { siteId: 'c2' } }), FOE, choiceOf({ kind: 'player', playerId: ME }, [siteTarget('c2')]))).toBeDefined()
    })

    it('site counts: the empty sites count toward Supremacy and the title follows them', () => {
        const s = board({ [ME]: [CROWN] }, {}, { oathType: OathType.Supremacy })
        expect(sitesRuledCount(s, ME)).toBe(1 + EMPTY_SITES.length)
        expect(playersMeetingOathkeeperGoal(s)).toEqual([ME])
        expect(sitesRuledCount(board({}), ME)).toBe(1)
    })

    it('the holder may put warbands on an empty site they stand at (R-6.5: "if you rule your site")', () => {
        const at = { [ME]: { siteId: 'c2' } }
        const move = { move: { kind: WarbandMoveKind.BoardToSite as const }, color: RED, count: 2 }
        expect(HydratedMoveWarbands.reasonCannotMove(board({ [ME]: [CROWN] }, at), ME, move)).toBeUndefined()
        expect(HydratedMoveWarbands.reasonCannotMove(board({}, at), ME, move)).toMatch(/do not rule/)
    })
})

describe('Bandit Crown — "except at sites ruled by enemies"', () => {
    it('an enemy\'s site is not the holder\'s: no rule, no access, no bandits there', () => {
        const s = board({ [ME]: [CROWN] }, {}, { denizensBySite: { c1: [], c2: [], p1: [], h1: [MESSENGER] } })
        for (const enemySite of ['h1', 'p1']) {
            expect(banditsServe(s, ME, enemySite), enemySite).toBe(false)
            expect(rulesSite(s, ME, enemySite), enemySite).toBe(false)
        }
        expect(rulersOfSite(s, 'h1')).toEqual([FOE])
        expect(accessibleCardIds(s, ME)).not.toContain(MESSENGER)
        expect(banditsServe(s, ME, 'c1')).toBe(true)
    })

    it('an Imperial holder: a fellow Imperial player is no enemy, an Exile is', () => {
        const s = board({ [CIT]: [CROWN] })
        expect(banditsServe(s, CIT, 'p1')).toBe(true)
        expect(banditsServe(s, CIT, 'h1')).toBe(false)
        expect(banditsServe(s, CIT, 'c1')).toBe(false)
        // R-5.5.1.a — suspended for one Campaign, the Citizen is the Chancellor's enemy.
        expect(banditsServe(s, CIT, 'p1', { nonImperialPlayerIds: [CIT] })).toBe(false)
        // The empty sites are the holder's alone; the Crown is not purple.
        expect(rulersOfSite(s, 'c2')).toEqual([CIT])
    })
})

describe('Bandit Crown — a relic is held, never ruled (R-7.1.1-H1)', () => {
    it('only while held, only for its holder: at a site, or in another bank, it gives `me` nothing', () => {
        const atSite = board({}, {}, { relicsBySite: { c1: [{ slotId: 'c1-r1' }] } })
        expect(rulesSite(atSite, ME, 'c2')).toBe(false)
        expect(banditsRuleSite(atSite, 'c2')).toBe(true)

        const foes = board({ [FOE]: [CROWN] })
        expect(rulesSite(foes, ME, 'c2')).toBe(false)
        expect(rulersOfSite(foes, 'c2')).toEqual([FOE])

        const lost = board({ [ME]: [CROWN] })
        lost.getPlayerState(ME).relicIds = []
        expect(rulesSite(lost, ME, 'c2')).toBe(false)
        expect(banditsRuleSite(lost, 'c2')).toBe(true)
    })
})

describe('Bandit Crown — the last physical warband (R-6.5, R-7.6.5)', () => {
    const lastOne = { move: { kind: WarbandMoveKind.SiteToBoard as const }, color: RED, count: 1 }

    it('the last physical warband may leave the holder\'s site, and the site stays theirs', () => {
        const s = board({ [ME]: [CROWN] })
        expect(HydratedMoveWarbands.maxMovable(s, ME, lastOne.move, Color.Red)).toBe(1)
        new HydratedMoveWarbands(buildAction(MoveWarbands, { playerId: ME, ...lastOne })).apply(s)
        expect(warbandsAt(s, 'c1')[Color.Red] ?? 0).toBe(0)
        expect(s.getPlayerState(ME).warbandsOnBoard[Color.Red]).toBe(5)
        expect(rulersOfSite(s, 'c1')).toEqual([ME])

        const bare = board({})
        expect(HydratedMoveWarbands.reasonCannotMove(bare, ME, lastOne)).toMatch(/the last one must stay/)
        const tooMany = HydratedMoveWarbands.reasonCannotMove(board({ [ME]: [CROWN] }), ME, { ...lastOne, count: 2 })
        expect(tooMany).toMatch(/at most 1$/)
    })

    it('the cards that print the same bound follow it: Messenger lifts the last warband too', () => {
        const s = board({ [ME]: [CROWN] })
        const index = powerIndexOf(MESSENGER, PowerTiming.Action)
        const group = { at: { kind: 'site' as const, siteId: 'c1' }, color: RED, count: 1 }
        const domain = legalPowers(s, ME, PowerTiming.Action).find((p) => p.cardId === MESSENGER)?.choices[0].options
        expect(domain).toContainEqual({ kind: PowerChoiceKind.Warbands, group })
        new HydratedUseActionPower(buildAction(UseActionPower, { playerId: ME, cardId: MESSENGER, powerIndex: index, choices: [{ kind: PowerChoiceKind.Warbands, group }] })).apply(s)
        expect(warbandsAt(s, 'c1')[Color.Red] ?? 0).toBe(0)
        expect(s.getPlayerState(ME).warbandsOnBoard[Color.Red]).toBe(5)
    })
})

describe('Bandit Crown — the defending force (R-5.5.4, R-7.6.5)', () => {
    it('bandits at targeted sites join the defending force, one a site, three with Bandit Chief', () => {
        const s = board({ [ME]: [CROWN] }, { [FOE]: { siteId: 'c2' } })
        campaignBy(FOE, { kind: 'player', playerId: ME }, [siteTarget('c2'), siteTarget('c1')], 3).apply(s)
        defendWithNothing(s)
        expect(s.campaign?.defendingBandits).toBe(2)
        // c1's one and the board's four (the pawn is on a target), plus the two bandits.
        expect(s.campaign?.defense).toBe(defenseShieldsFromFaces(s.campaign?.defenseRoll ?? []) + 5 + 2)

        const chief = board({ [ME]: [CROWN] }, { [FOE]: { siteId: 'c2' } }, { denizensBySite: { c1: [], c2: [], p1: [], h1: [BANDIT_CHIEF] } })
        campaignBy(FOE, { kind: 'player', playerId: ME }, [siteTarget('c2')], 3).apply(chief)
        defendWithNothing(chief)
        expect(chief.campaign?.defendingBandits).toBe(3)

        const bare = board({}, { [FOE]: { siteId: 'c1' } })
        campaignBy(FOE, { kind: 'player', playerId: ME }, [siteTarget('c1')], 3).apply(bare)
        defendWithNothing(bare)
        expect(bare.campaign?.defendingBandits).toBe(0)
    })

    it('an Ally\'s Crown counts too: the bandits at a targeted site are warbands of a player on the defending side', () => {
        const build = (relics: Partial<Record<string, string[]>>) => {
            const s = board(relics, { [FOE]: { siteId: 'p1' } })
            campaignBy(FOE, { kind: 'player', playerId: CIT }, [siteTarget('p1')], 3).apply(s)
            defendWithNothing(s)
            return s
        }
        const s = build({ [CHAN]: [CROWN] })
        expect(s.campaign?.allyPlayerIds).toEqual([CHAN])
        expect(s.campaign?.defendingBandits).toBe(1)
        expect(build({}).campaign?.defendingBandits).toBe(0)
        expect(build({ [ME]: [CROWN] }).campaign?.defendingBandits).toBe(0)
    })
})

describe('Bandit Crown — "They cannot be killed, moved, or sacrificed."', () => {
    it('cannot be killed: a lost site of bandits alone kills nothing, even three of them, and the battle resolves', () => {
        const s = foeBeatsMeAt('c2', (seed) => board({ [ME]: [CROWN] }, { [FOE]: { siteId: 'c2' } }, { denizensBySite: { c1: [], c2: [], p1: [], h1: [BANDIT_CHIEF] }, prng: { seed, invocations: 0 } }))
        expect(s.campaign?.defendingBandits).toBe(3)
        expect(HydratedCampaignSacrifice.defaultDefeatKills(s, 0)).toEqual([])
        expect(HydratedCampaignSacrifice.reasonCannotResolve(s, FOE, { sacrifice: 0, defeatKills: [] })).toBeUndefined()
    })

    it('cannot be killed: the bandit counts in the force whose half dies, and the kill falls on the warbands', () => {
        const build = (relics: string[]) => (seed: number) => board({ [ME]: relics }, { [FOE]: { siteId: 'c2' }, [ME]: { siteId: 'h3' } }, { warbandsBySite: { c1: { [Color.Red]: 1 }, c2: { [Color.Red]: 1 }, h1: { [Color.Blue]: 3 } }, prng: { seed, invocations: 0 } })
        const s = foeBeatsMeAt('c2', build([CROWN]))
        // One warband and one bandit: half of two is one, and only the warband can die.
        expect(HydratedCampaignSacrifice.defaultDefeatKills(s, 0)).toEqual([{ at: { kind: 'site', siteId: 'c2' }, color: Color.Red, count: 1 }])
        // Without the Crown the force is the one warband, and half of one is none.
        expect(HydratedCampaignSacrifice.defaultDefeatKills(foeBeatsMeAt('c2', build([])), 0)).toEqual([])
    })

    it('cannot be moved: defeat sends the warbands home and leaves the bandits, so a victor who places nothing leaves the site the holder\'s', () => {
        const s = foeBeatsMeAt('c2', (seed) => board({ [ME]: [CROWN] }, { [FOE]: { siteId: 'c2' } }, { prng: { seed, invocations: 0 } }))
        new HydratedCampaignSacrifice(buildAction(CampaignSacrifice, { playerId: FOE, sacrifice: 0, defeatKills: [] })).apply(s)
        if (s.campaign) new HydratedCampaignResolveVictory(buildAction(CampaignResolveVictory, { playerId: FOE, placements: [], burnFavor: false })).apply(s)
        expect(rulersOfSite(s, 'c2')).toEqual([ME])
        // R-6.5 — an empty site has nothing to lift.
        const there = board({ [ME]: [CROWN] }, { [ME]: { siteId: 'c2' } })
        expect(HydratedMoveWarbands.legalMoves(there, ME).filter((m) => m.move.kind === WarbandMoveKind.SiteToBoard)).toEqual([])
    })

    it('cannot be sacrificed: the holder\'s attacking force is their board, and Vow of Union adds nothing from a site of bandits alone', () => {
        const s = board({ [ME]: [CROWN] }, { [ME]: { siteId: 'h1', advisers: [{ cardId: VOW_OF_UNION, faceUp: true }], warbandsOnBoard: { [Color.Red]: 2 } } })
        // Two on the board and one at c1 through the Vow; the five empty sites give none.
        expect(HydratedCampaign.reasonCannotCampaign(s, ME, choiceOf({ kind: 'player', playerId: FOE }, [siteTarget('h1')], 3))).toBeUndefined()
        expect(HydratedCampaign.reasonCannotCampaign(s, ME, choiceOf({ kind: 'player', playerId: FOE }, [siteTarget('h1')], 4))).toBeDefined()
    })
})

function maskBoard(holder = ME, turn = ME, over: Record<string, Record<string, unknown>> = {}) {
    return board({ [holder]: [MASK] }, over, { denizensBySite: { c1: [], c2: [], p1: [MESSENGER, LONGBOWS], h1: [] } }, turn)
}

describe('Grand Mask — "you rule cards … at Imperial sites"', () => {
    it('during the Exile holder\'s turn they rule the denizens at a purple site, from anywhere', () => {
        const s = maskBoard()
        expect(rulesCard(s, ME, MESSENGER)).toBe(true)
        expect(hasAccessToCard(s, ME, MESSENGER)).toBe(true)
        const bare = board({}, {}, { denizensBySite: { c1: [], c2: [], p1: [MESSENGER, LONGBOWS], h1: [] } })
        expect(rulesCard(bare, ME, MESSENGER)).toBe(false)
    })

    it('the lists agree with rulesCard: access, the Action panel\'s list, and "cards you rule"', () => {
        const s = maskBoard()
        expect(accessibleCardIds(s, ME)).toContain(MESSENGER)
        expect(legalPowers(s, ME, PowerTiming.Action).map((p) => p.cardId)).toContain(MESSENGER)
        expect(ruledFaceupCardIds(s, ME)).toEqual([MESSENGER])
        expect(ruledCardsOfSuit(s, ME, Suit.Order)).toEqual([MESSENGER])
        expect(accessibleCardIds(s, CHAN)).toContain(LONGBOWS)
        expect(ruledFaceupCardIds(s, FOE)).toEqual([])
    })

    it('it is rule of cards, not of sites: no site, no Campaign target, no site count changes hands', () => {
        const s = maskBoard()
        expect(rulesSite(s, ME, 'p1')).toBe(false)
        expect(rulersOfSite(s, 'p1').sort()).toEqual([CHAN, CIT].sort())
        expect(sitesRuledCount(s, ME)).toBe(1)
        expect(sitesRuledCount(s, CHAN)).toBe(1)
        const moved = maskBoard(ME, ME, { [ME]: { siteId: 'p1' } })
        expect(HydratedCampaign.reasonCannotCampaign(moved, ME, choiceOf({ kind: 'player', playerId: CHAN }, [siteTarget('p1')]))).toBeUndefined()
    })

    it('only at Imperial sites: a card at an Exile\'s site, or at an empty one, is untouched', () => {
        const s = board({ [ME]: [MASK] }, {}, { denizensBySite: { c1: [], c2: [LONGBOWS], p1: [], h1: [MESSENGER] } })
        expect(rulesCard(s, ME, MESSENGER)).toBe(false)
        expect(rulesCard(s, FOE, MESSENGER)).toBe(true)
        expect(rulesCard(s, ME, LONGBOWS)).toBe(false)
    })
})

describe('Grand Mask — "If you\'re an Exile, during your turn"', () => {
    it('a Citizen holder gets nothing from it, and takes nothing from the Chancellor', () => {
        const s = maskBoard(CIT, CIT, { [CIT]: { siteId: 'c2' } })
        expect(rulesCard(s, CIT, MESSENGER)).toBe(true)
        expect(rulesCard(s, CHAN, MESSENGER)).toBe(true)
        expect(ruledFaceupCardIds(s, CHAN)).toContain(MESSENGER)
    })

    it('on anyone else\'s turn the Empire rules its cards and the holder does not', () => {
        const s = maskBoard(ME, CHAN)
        expect(rulesCard(s, ME, MESSENGER)).toBe(false)
        expect(accessibleCardIds(s, ME)).not.toContain(MESSENGER)
        expect(rulesCard(s, CHAN, MESSENGER)).toBe(true)
        expect(rulesCard(s, CIT, MESSENGER)).toBe(true)
    })
})

describe('Grand Mask — "except battle plans"', () => {
    it('the holder gains no battle plan, and the Imperial players keep theirs', () => {
        const s = maskBoard()
        expect(rulesCard(s, ME, LONGBOWS)).toBe(false)
        expect(mayUseBattlePlansOf(s, ME, LONGBOWS)).toBe(false)
        expect(usableBattlePlans(s, ME, BattlePlanSide.Attacker).map((p) => p.cardId)).not.toContain(LONGBOWS)
        expect(ruledFaceupCardIds(s, ME)).not.toContain(LONGBOWS)
        for (const imperial of [CHAN, CIT]) {
            expect(mayUseBattlePlansOf(s, imperial, LONGBOWS), imperial).toBe(true)
            expect(usableBattlePlans(s, imperial, BattlePlanSide.Defender).map((p) => p.cardId), imperial).toContain(LONGBOWS)
        }
    })
})

describe('Grand Mask — "and Imperial players do not"', () => {
    it('the Chancellor and the Citizens lose rule of those cards for the turn, wherever their pawns are', () => {
        const s = maskBoard(ME, ME, { [CIT]: { siteId: 'c2' } })
        for (const imperial of [CHAN, CIT]) expect(rulesCard(s, imperial, MESSENGER), imperial).toBe(false)
        expect(ruledFaceupCardIds(s, CHAN)).toEqual([LONGBOWS])
        expect(ruledCardsOfSuit(s, CIT, Suit.Order)).toEqual([LONGBOWS])
        // R-7.1.1 — the Chancellor's pawn at p1 still gives access; the Citizen's at c2 does not.
        expect(hasAccessToCard(s, CHAN, MESSENGER)).toBe(true)
        expect(accessibleCardIds(s, CHAN)).toContain(MESSENGER)
        expect(hasAccessToCard(s, CIT, MESSENGER)).toBe(false)
        expect(accessibleCardIds(s, CIT)).not.toContain(MESSENGER)
    })

    it('another Exile is neither given nor denied anything', () => {
        const s = maskBoard()
        expect(rulesCard(s, FOE, MESSENGER)).toBe(false)
        const theirs = board({ [ME]: [MASK] }, {}, { denizensBySite: { c1: [], c2: [], p1: [], h1: [MESSENGER] } })
        expect(rulesCard(theirs, FOE, MESSENGER)).toBe(true)
    })

    it('a persistent power at an Imperial site still belongs to the site\'s rulers (R-7.1.4 ignores access)', () => {
        const TOLL_ROADS = 'denizen.order.toll-roads'
        const s = board({ [ME]: [MASK] }, {}, { denizensBySite: { c1: [], c2: [], p1: [TOLL_ROADS], h1: [] } })
        const tolls = persistentsInPlay(s).find((p) => p.ctx.cardId === TOLL_ROADS)
        expect(tolls?.ctx.ownerIds.slice().sort()).toEqual([CHAN, CIT].sort())
    })
})

describe('the two together', () => {
    it('a Chancellor\'s Crown makes no site Imperial: the Mask reaches purple sites only', () => {
        const s = board({ [ME]: [MASK], [CHAN]: [CROWN] }, {}, { denizensBySite: { c1: [], c2: [MESSENGER], p1: [], h1: [] } })
        expect(rulersOfSite(s, 'c2')).toEqual([CHAN])
        expect(rulesCard(s, CHAN, MESSENGER)).toBe(true)
        expect(rulesCard(s, ME, MESSENGER)).toBe(false)
    })
})
