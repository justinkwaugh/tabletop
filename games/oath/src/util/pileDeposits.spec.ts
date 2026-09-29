import { describe, expect, it } from 'vitest'
import { Color } from '@tabletop/common'
import { HydratedUseActionPower, UseActionPower } from '../actions/useActionPower.js'
import { SearchPlay } from '../actions/searchResolve.js'
import { HydratedPlayFacedownAdviser, PlayFacedownAdviser } from '../actions/playFacedownAdviser.js'
import { HydratedCampaign, Campaign } from '../actions/campaign.js'
import { HydratedCampaignDefend, CampaignDefend } from '../actions/campaignDefend.js'
import { HydratedCampaignSacrifice, CampaignSacrifice } from '../actions/campaignSacrifice.js'
import { HydratedCampaignResolveVictory, CampaignResolveVictory } from '../actions/campaignResolveVictory.js'
import { CampaignTargetKind } from '../model/campaign.js'
import { Banner, PlayerStatus, Region } from '../model/oathEnums.js'
import { type PowerChoice } from './powerChoice.js'
import { testPlayer, testState, testVaultWithRelics, openTurn } from '../testing/fixture.js'
import '../powers/index.js'
import { buildAction, defendingSideChooses } from '../testing/actions.js'
import { battlePlanUse, slot, yes } from '../testing/choices.js'
import { FILLER } from '../testing/cards.js'
import { discardInListedOrder, playDrawnCard } from '../testing/steps.js'
import { expectCountsMatchTheVault } from '../testing/census.js'
import { adviser } from '../testing/tables.js'

const BALLOT = 'denizen.hearth.ballot-box'
const HEIR = 'denizen.beast.long-lost-heir'
const BEWITCH = 'denizen.arcane.bewitch'
const AMBITIONS = 'denizen.discord.royal-ambitions'
const MARTIAL = 'denizen.order.martial-culture'
const STORM_CALLER = 'denizen.nomad.storm-caller'
const RAIN_BOOTS = 'denizen.nomad.rain-boots'
const VISION = 'vision.faith'

const ME = 'me'
const FOE = 'foe'
const RED: Color = Color.Red
const BLUE: Color = Color.Blue

/** R-10.5 — c1 is in the Cradle, so its discards go to the Provinces pile. */
function board(over: Record<string, Record<string, unknown>> = {}, state: Record<string, unknown> = {}) {
    const s = testState(
        [
            testPlayer({ playerId: ME, color: Color.Red, status: PlayerStatus.Exile, siteId: 'c1', favor: 4, secrets: 4, supply: 6, revealedVisionId: VISION, warbandsOnBoard: { [RED]: 6 }, warbandsInPersonalBank: { [RED]: 6 }, ...over[ME] }),
            testPlayer({ playerId: FOE, color: Color.Blue, status: PlayerStatus.Exile, siteId: 'c1', favor: 4, secrets: 2, supply: 6, warbandsOnBoard: { [BLUE]: 2 }, ...over[FOE] }),
            testPlayer({ playerId: 'chan', color: Color.Purple, status: PlayerStatus.Chancellor, siteId: 'h1', favor: 2, secrets: 2, warbandsInPersonalBank: { purple: 12 }, ...over['chan'] })
        ],
        {
            chancellorPlayerId: 'chan',
            denizensBySite: { c1: [], c2: [], h1: [] },
            warbandsBySite: { c1: { [BLUE]: 1 }, c2: { [RED]: 1 }, h1: { purple: 1 } },
            ...state
        }
    )
    openTurn(s, ME)
    return s
}
type Board = ReturnType<typeof board>

function expectVisionInTheVault(s: Board, action: { revealsInfo?: boolean; metadata?: { pileDeposits?: unknown } }, under: string[] = []) {
    expect(s.getPlayerState(ME).status).toBe(PlayerStatus.Citizen)
    expect(s.getPlayerState(ME).revealedVisionId).toBeUndefined()
    expect(s.requireVault().discardPiles[Region.Provinces]).toEqual([VISION, ...under])
    expect(action.metadata?.pileDeposits).toEqual([{ region: Region.Provinces, cardIds: [VISION] }])
    expect(action.revealsInfo).toBe(true)
    expectCountsMatchTheVault(s)
}

function search(s: Board, cardId: string, to: SearchPlay, choices: PowerChoice[]) {
    const a = playDrawnCard(s, cardId, to, choices, ME)
    defendingSideChooses(s)
    return a
}

describe("a power's route to Citizenship discards the revealed Vision into the vault's pile (R-6.6.2)", () => {
    it('Ballot Box, through UseActionPower', () => {
        const s = board({ [ME]: { advisers: [adviser(BALLOT)] } }, { banners: { [Banner.PeoplesFavor]: { holderPlayerId: ME, value: 1 }, [Banner.DarkestSecret]: { value: 1 } } })
        const a = new HydratedUseActionPower(buildAction(UseActionPower, { playerId: ME, cardId: BALLOT, powerIndex: 0 }))
        a.apply(s)
        expectVisionInTheVault(s, defendingSideChooses(s) ?? a)
    })

    it("Long-Lost Heir, by a Search's play and by the R-6.1 flip", () => {
        const searched = board()
        expectVisionInTheVault(searched, search(searched, HEIR, SearchPlay.Adviser, [yes]), [FILLER])

        const flipped = board({ [ME]: { advisers: [adviser(HEIR, false)] } })
        const a = new HydratedPlayFacedownAdviser(buildAction(PlayFacedownAdviser, { playerId: ME, cardId: HEIR, play: SearchPlay.Adviser, choices: [yes] }))
        a.apply(flipped)
        defendingSideChooses(flipped)
        expectVisionInTheVault(flipped, a)
    })

    it('Bewitch', () => {
        const s = board()
        expectVisionInTheVault(s, search(s, BEWITCH, SearchPlay.Site, [yes]), [FILLER])
    })

    it('Royal Ambitions, the route that also takes a Reliquary relic', () => {
        const s = board({}, { reliquary: [{ slotId: 'reliquary.0' }], vault: testVaultWithRelics({ 'reliquary.0': 'relic.cup-of-plenty' }), warbandsBySite: { c1: { [BLUE]: 1 }, c2: { [RED]: 1 } } })
        const a = search(s, AMBITIONS, SearchPlay.Adviser, [yes, slot('reliquary.0')])
        expectVisionInTheVault(s, a, [FILLER])
    })

    it('Martial Culture, from inside the Campaign that earns it', () => {
        const s = board({ [ME]: { advisers: [adviser(MARTIAL)] } })
        new HydratedCampaign(buildAction(Campaign, { playerId: ME, defender: { kind: 'player', playerId: FOE }, targets: [{ kind: CampaignTargetKind.Site, siteId: 'c1' }], attackDice: 3, plans: [battlePlanUse(MARTIAL)] })).apply(s)
        Object.assign(s.campaign ?? {}, { swords: 9, defense: 0 })
        const a = new HydratedCampaignSacrifice(buildAction(CampaignSacrifice, { playerId: ME, sacrifice: 0, defeatKills: HydratedCampaignSacrifice.attackerDefeatKills(s, 0) }))
        a.apply(s)
        defendingSideChooses(s)
        // R-5.5.8 — its "if you're victorious" comes after R-5.5.7, in the victory's record.
        const victory = new HydratedCampaignResolveVictory(buildAction(CampaignResolveVictory, { playerId: ME, placements: [], burnFavor: false }))
        victory.apply(s)
        expectVisionInTheVault(s, victory)
    })

    it('a Citizen-to-be with no revealed Vision deposits nothing', () => {
        const s = board({ [ME]: { revealedVisionId: undefined } })
        const a = search(s, HEIR, SearchPlay.Adviser, [yes])
        expect(s.getPlayerState(ME).status).toBe(PlayerStatus.Citizen)
        expect(a.metadata?.pileDeposits).toBeUndefined()
        expect(s.requireVault().discardPiles[Region.Provinces]).toEqual([FILLER])
        expectCountsMatchTheVault(s)
    })
})

describe('the "At end, discard" battle plans of a Campaign reach the vault\'s pile however it ends (R-5.5.8)', () => {
    function campaign(s: Board, attackerPlans: string[], defenderPlans: string[]) {
        new HydratedCampaign(buildAction(Campaign, { playerId: ME, defender: { kind: 'player', playerId: FOE }, targets: [{ kind: CampaignTargetKind.Site, siteId: 'c1' }], attackDice: 3, plans: attackerPlans.map(battlePlanUse) })).apply(s)
        if (s.campaign?.pendingDefenderPlans) new HydratedCampaignDefend(buildAction(CampaignDefend, { playerId: FOE, plans: defenderPlans.map(battlePlanUse) })).apply(s)
    }
    function sacrifice(s: Board, outcome: { swords: number; defense: number }) {
        Object.assign(s.campaign ?? {}, outcome)
        const a = new HydratedCampaignSacrifice(buildAction(CampaignSacrifice, { playerId: ME, sacrifice: 0, defeatKills: HydratedCampaignSacrifice.attackerDefeatKills(s, 0) }))
        a.apply(s)
        defendingSideChooses(s)
        return a
    }

    it('a defeated attacker: the Campaign ends in CampaignSacrifice, which commits the discard', () => {
        const s = board({ [FOE]: { advisers: [adviser(STORM_CALLER)] } })
        campaign(s, [], [STORM_CALLER])
        const a = sacrifice(s, { swords: 0, defense: 9 })
        expect(s.campaign).toBeUndefined()
        expect(s.getPlayerState(FOE).advisers).toEqual([])
        expect(s.requireVault().discardPiles[Region.Provinces]).toEqual([STORM_CALLER])
        expect(a.metadata?.pileDeposits).toEqual([{ region: Region.Provinces, cardIds: [STORM_CALLER] }])
        expect(a.revealsInfo).toBe(true)
        expectCountsMatchTheVault(s)
    })

    it('a victorious attacker: the Campaign ends in CampaignResolveVictory, which commits the discard', () => {
        const s = board({ [FOE]: { advisers: [adviser(STORM_CALLER)] } })
        campaign(s, [], [STORM_CALLER])
        const sacrificed = sacrifice(s, { swords: 9, defense: 0 })
        expect(sacrificed.metadata?.pileDeposits).toBeUndefined()
        expect(s.requireVault().discardPiles[Region.Provinces]).toEqual([])

        const a = new HydratedCampaignResolveVictory(buildAction(CampaignResolveVictory, { playerId: ME, placements: [], burnFavor: false }))
        a.apply(s)
        defendingSideChooses(s)
        expect(s.campaign).toBeUndefined()
        expect(s.requireVault().discardPiles[Region.Provinces]).toEqual([STORM_CALLER])
        expect(a.metadata?.pileDeposits).toEqual([{ region: Region.Provinces, cardIds: [STORM_CALLER] }])
        expect(a.revealsInfo).toBe(true)
        expectCountsMatchTheVault(s)
    })

    it("both sides' plans go in the order the attacker gives (Law Glossary \"Discard\"), the last on top", () => {
        const s = board({ [ME]: { advisers: [adviser(RAIN_BOOTS)] }, [FOE]: { advisers: [adviser(STORM_CALLER)] } })
        campaign(s, [RAIN_BOOTS], [STORM_CALLER])
        sacrifice(s, { swords: 9, defense: 0 })
        new HydratedCampaignResolveVictory(buildAction(CampaignResolveVictory, { playerId: ME, placements: [], burnFavor: false })).apply(s)
        discardInListedOrder(s)
        expect(s.requireVault().discardPiles[Region.Provinces]).toEqual([STORM_CALLER, RAIN_BOOTS])
        expectCountsMatchTheVault(s)
    })

    it('Law Glossary "Discard": an adviser leaves from its holder’s pawn region, and its secrets go to the attacker', () => {
        const s = board({ [FOE]: { siteId: 'h1', advisers: [adviser(STORM_CALLER)] } }, { cardTokens: { [STORM_CALLER]: { favor: 0, secrets: 1 } } })
        campaign(s, [], [STORM_CALLER])
        const a = sacrifice(s, { swords: 0, defense: 9 })
        expect(s.requireVault().discardPiles[Region.Cradle]).toEqual([STORM_CALLER])
        expect(a.metadata?.pileDeposits).toEqual([{ region: Region.Cradle, cardIds: [STORM_CALLER] }])
        expect(s.getPlayerState(ME).secretsFacedown).toBe(1)
        expect(s.getPlayerState(FOE).secretsFacedown).toBe(0)
        expectCountsMatchTheVault(s)
    })

    it('Law Glossary "Discard": a card at a site leaves from the card’s region, not the attacker’s', () => {
        const s = board({}, { denizensBySite: { c1: [], c2: [], p1: [STORM_CALLER], h1: [] }, warbandsBySite: { c1: { [BLUE]: 1 }, c2: { [RED]: 1 }, p1: { [BLUE]: 1 }, h1: { purple: 1 } } })
        campaign(s, [], [STORM_CALLER])
        const a = sacrifice(s, { swords: 0, defense: 9 })
        expect(s.denizensBySite.p1).toEqual([])
        expect(s.requireVault().discardPiles[Region.Hinterland]).toEqual([STORM_CALLER])
        expect(a.metadata?.pileDeposits).toEqual([{ region: Region.Hinterland, cardIds: [STORM_CALLER] }])
        expectCountsMatchTheVault(s)
    })

    it('plans leaving from different regions make one deposit per pile', () => {
        const s = board({ [ME]: { advisers: [adviser(RAIN_BOOTS)] }, [FOE]: { siteId: 'h1', advisers: [adviser(STORM_CALLER)] } })
        campaign(s, [RAIN_BOOTS], [STORM_CALLER])
        const a = sacrifice(s, { swords: 0, defense: 9 })
        expect(a.metadata?.pileDeposits).toEqual([
            { region: Region.Provinces, cardIds: [RAIN_BOOTS] },
            { region: Region.Cradle, cardIds: [STORM_CALLER] }
        ])
        expectCountsMatchTheVault(s)
    })

    it('a Campaign with no "at end" plan deposits nothing and stays as undoable as it was', () => {
        const s = board()
        campaign(s, [], [])
        const a = sacrifice(s, { swords: 0, defense: 9 })
        expect(a.metadata?.pileDeposits).toBeUndefined()
        expect(a.revealsInfo).toBe(false)
        expectCountsMatchTheVault(s)
    })
})
