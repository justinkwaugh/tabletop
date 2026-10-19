import { describe, expect, it } from 'vitest'
import { assertExists, Color, getPrng } from '@tabletop/common'
import { HydratedCampaign, type CampaignDefender, Campaign } from '../actions/campaign.js'
import { HydratedCampaignDefend, CampaignDefend } from '../actions/campaignDefend.js'
import { HydratedCampaignSacrifice, CampaignSacrifice } from '../actions/campaignSacrifice.js'
import { HydratedCampaignResolveVictory, CampaignResolveVictory } from '../actions/campaignResolveVictory.js'
import { HydratedUseActionPower, UseActionPower } from '../actions/useActionPower.js'
import { CampaignTargetKind, type CampaignTarget, type WarbandGroup } from '../model/campaign.js'
import { PlayerStatus } from '../model/oathEnums.js'
import { BattlePlanSide, powersWithTiming, PowerTiming, powerIndexOf } from '../data/cardPowers.js'
import { partiesSuspendingNobody, testPlayer, testState, openTurn } from '../testing/fixture.js'
import { legalChoices, PowerChoiceKind, type PowerChoice } from '../util/powerChoice.js'
import { legalPowers } from '../util/powerDoorway.js'
import { usableBattlePlans } from '../util/battlePlans.js'
import { rulesSite } from '../util/rule.js'
import { warbandsOnBoardOf } from '../util/force.js'
import { expectWarbandsConserved } from '../testing/census.js'
import { required } from '../testing/required.js'
import { createOathVault } from '../model/vault.js'
import { hasEffect } from './registry.js'
import '../powers/index.js'
import { PowerQuestionKind, type CagePlacement } from '../model/question.js'
import { HydratedAnswerQuestion } from '../actions/answerQuestion.js'
import { HydratedOathGameState } from '../model/gameState.js'
import { OathVisibility } from '../definition/runtime.js'
import { served } from '../testing/projection.js'
import { cagePurpleChoiceBoards, reasonCagePlacementInvalid } from '../util/obsidianCage.js'
import { answerQuestion } from '../testing/steps.js'
import { buildAction, defendingSideChooses } from '../testing/actions.js'
import { siteTarget, battlePlanUse, actionPowerUse, boardWarbands } from '../testing/choices.js'
import { IMPERIAL_WARBANDS } from '../model/warbandCounts.js'
import { OathRevision } from '../util/revision.js'
import { CHANCELLOR_WARBANDS } from '../util/setup.js'

/** R-10.9's force; the move to the Cage stands in for R-5.5.6's move to their board. */
const CAGE = 'relic.obsidian-cage'
const CROWN = 'relic.bandit-crown'

const ME = 'me'
const FOE = 'foe'
const CHAN = 'chan'
const CIT = 'cit'

const PLAN = battlePlanUse(CAGE)
const ACTION_INDEX = powerIndexOf(CAGE, PowerTiming.Action)

function board(
    relics: Partial<Record<string, string[]>>,
    over: Record<string, Record<string, unknown>> = {},
    state: Record<string, unknown> = {},
    turn = ME
) {
    const s = testState(
        [
            testPlayer({ playerId: ME, color: Color.Red, siteId: 'c1', favor: 4, secrets: 2, supply: 6, relicIds: relics[ME] ?? [], warbandsOnBoard: { [ME]: 4 }, warbandsInPersonalBank: { [ME]: 6 }, ...over[ME] }),
            testPlayer({ playerId: FOE, color: Color.Blue, siteId: 'c1', favor: 4, secrets: 2, supply: 6, relicIds: relics[FOE] ?? [], warbandsOnBoard: { [FOE]: 3 }, warbandsInPersonalBank: { [FOE]: 5 }, ...over[FOE] }),
            testPlayer({ playerId: CHAN, color: Color.Purple, status: PlayerStatus.Chancellor, siteId: 'p1', favor: 4, secrets: 2, supply: 6, relicIds: relics[CHAN] ?? [], warbandsOnBoard: { [IMPERIAL_WARBANDS]: 3 }, warbandsInPersonalBank: { [IMPERIAL_WARBANDS]: 8 }, ...over[CHAN] }),
            testPlayer({ playerId: CIT, color: Color.Yellow, status: PlayerStatus.Citizen, siteId: 'p1', favor: 4, secrets: 2, supply: 6, relicIds: relics[CIT] ?? [], warbandsOnBoard: { [IMPERIAL_WARBANDS]: 2 }, warbandsInPersonalBank: { [CIT]: 14 }, ...over[CIT] })
        ],
        {
            chancellorPlayerId: CHAN,
            denizensBySite: { c1: [], c2: [], p1: [] },
            warbandsBySite: { c1: { [FOE]: 3 }, c2: { [ME]: 1 }, p1: { [IMPERIAL_WARBANDS]: 2 } },
            ...state
        }
    )
    openTurn(s, turn)
    s.activePlayerIds = [turn]
    return s
}
type Board = ReturnType<typeof board>

function campaign(s: Board, attackerId: string, defender: CampaignDefender, targets: CampaignTarget[], plans?: (typeof PLAN)[]) {
    new HydratedCampaign(buildAction(Campaign, { playerId: attackerId, defender, targets, attackDice: 1, plans })).apply(s)
}
function defend(s: Board, plansOf: Partial<Record<string, (typeof PLAN)[]>> = {}) {
    while (s.campaign?.pendingDefenderPlans) {
        const playerId = s.campaign.pendingDefenderPlans.queue[0]
        assertExists(playerId, 'the battle-plan step is open with nobody to answer it')
        new HydratedCampaignDefend(buildAction(CampaignDefend, { playerId, plans: plansOf[playerId] ?? [] })).apply(s)
    }
}
/** Overwrites the dice so the named side wins with no sacrifice. */
function decide(s: Board, attackerWins: boolean, defeatKills?: WarbandGroup[]) {
    const c = s.campaign
    assertExists(c, 'no Campaign is under way')
    c.swords = attackerWins ? 9 : 0
    c.defense = attackerWins ? 0 : 9
    const attackerKills = attackerWins ? [] : (defeatKills ?? HydratedCampaignSacrifice.attackerDefeatKills(s, 0))
    const sacrifice = new HydratedCampaignSacrifice(buildAction(CampaignSacrifice, { playerId: c.attackerPlayerId, sacrifice: 0, defeatKills: attackerKills }))
    sacrifice.apply(s)
    return defendingSideChooses(s, defeatKills) ?? sacrifice
}
function useAction(s: Board, playerId: string, choices: PowerChoice[]) {
    const action = new HydratedUseActionPower(buildAction(UseActionPower, { playerId, cardId: CAGE, powerIndex: ACTION_INDEX, choices }))
    action.apply(s)
    return action
}
const reasonCannotUse = (s: Board, playerId: string, choices: PowerChoice[]) =>
    HydratedUseActionPower.reasonCannotUse(s, playerId, CAGE, ACTION_INDEX, choices)
const caged = (over: Record<string, number>) => ({ warbandsOnCards: { [CAGE]: over } })

describe('Obsidian Cage — registered', () => {
    it('both powers on the one record have effects, and the plan is a held relic’s (R-7.1.1-H1)', () => {
        const [plan, action] = [powersWithTiming(CAGE, PowerTiming.BattlePlan)[0], powersWithTiming(CAGE, PowerTiming.Action)[0]]
        expect(hasEffect(plan)).toBe(true)
        expect(hasEffect(action)).toBe(true)
        const s = board({ [ME]: [CAGE] })
        for (const side of [BattlePlanSide.Attacker, BattlePlanSide.Defender]) {
            expect(usableBattlePlans(s, ME, side, partiesSuspendingNobody(s, ME)).map((p) => p.cardId)).toContain(CAGE)
            expect(usableBattlePlans(s, FOE, side, partiesSuspendingNobody(s, ME)).map((p) => p.cardId)).not.toContain(CAGE)
        }
    })
})

describe("Obsidian Cage — \"If you're victorious, move all unkilled warbands in your enemy's force to the Obsidian Cage\"", () => {
    it('as the attacker: the defending force’s survivors, at the site and on the board alike, go to the Cage and not home', () => {
        const s = board({ [ME]: [CAGE] })
        let note: string[] | undefined
        let ownForceAtTheSacrifice: number | undefined
        expectWarbandsConserved(s, () => {
            campaign(s, ME, { kind: 'player', playerId: FOE }, [siteTarget('c1')], [PLAN])
            defend(s)
            // R-10.9 — the board counts since foe's pawn stands at c1.
            expect(s.campaign?.defendingForce).toEqual([
                { at: { kind: 'site', siteId: 'c1' }, owner: FOE, count: 3 },
                { at: { kind: 'board', playerId: FOE }, owner: FOE, count: 3 }
            ])
            ownForceAtTheSacrifice = s.getPlayerState(ME).warbandsOnBoard[ME]
            note = decide(s, true, [
                { at: { kind: 'site', siteId: 'c1' }, owner: FOE, count: 1 },
                { at: { kind: 'board', playerId: FOE }, owner: FOE, count: 2 }
            ]).metadata?.planNotes
        })
        // R-5.5.6 — half (three) die to the bank; the other three are caged.
        expect(s.warbandsOnCard(CAGE)).toEqual({ [FOE]: 3 })
        expect(s.getPlayerState(FOE).warbandsInPersonalBank[FOE]).toBe(8)
        expect(s.getPlayerState(FOE).warbandsOnBoard[FOE]).toBe(0)
        expect(s.warbandsBySite['c1'][FOE]).toBe(0)
        expect(note).toEqual([`Obsidian Cage: ${ME} moved the enemy's 3 unkilled warbands to the Cage`])
        expect(s.getPlayerState(ME)).toMatchObject({ favor: 4, secrets: 2 })
        expect(s.getPlayerState(ME).warbandsOnBoard[ME]).toBe(ownForceAtTheSacrifice)
        expect(s.tokensOn(CAGE)).toEqual({ favor: 0, secrets: 0 })
        // R-5.5.7 still runs for the attacker.
        new HydratedCampaignResolveVictory(buildAction(CampaignResolveVictory, { playerId: ME, placements: [{ siteId: 'c1', owner: ME, count: 1 }], burnFavor: false })).apply(s)
        expect(s.campaign).toBeUndefined()
        expect(rulesSite(s, ME, 'c1')).toBe(true)
    })

    it('as the defender ("either side"): the attacker’s force is the warbands on their board, and its survivors are caged', () => {
        const s = board({ [ME]: [CAGE] }, {}, {}, FOE)
        let attackingForce = 0
        expectWarbandsConserved(s, () => {
            campaign(s, FOE, { kind: 'player', playerId: ME }, [{ kind: CampaignTargetKind.PawnAndFavor }])
            defend(s, { [ME]: [PLAN] })
            // R-5.5.5 — a skull may already have cost the attacker a warband.
            attackingForce = required(s.getPlayerState(FOE).warbandsOnBoard[FOE], 'the attacker’s blue warbands')
            decide(s, false)
        })
        // R-5.5.6 — half, rounded down, die; the rest go to the Cage.
        expect(attackingForce).toBeGreaterThanOrEqual(2)
        expect(s.warbandsOnCard(CAGE)).toEqual({ [FOE]: attackingForce - Math.floor(attackingForce / 2) })
        expect(s.getPlayerState(FOE).warbandsOnBoard[FOE]).toBe(0)
        // R-10.9 — foe's warbands at c1 are in no force and stay.
        expect(s.warbandsBySite['c1'][FOE]).toBe(3)
        expect(s.campaign).toBeUndefined()
    })

    it('defeated, the Cage takes nothing: the user’s own survivors stay home and the enemy’s force is untouched', () => {
        const s = board({ [ME]: [CAGE] })
        campaign(s, ME, { kind: 'player', playerId: FOE }, [siteTarget('c1')], [PLAN])
        defend(s)
        const ownForce = required(s.getPlayerState(ME).warbandsOnBoard[ME], 'my red warbands')
        const notes = decide(s, false).metadata?.planNotes
        expect(s.warbandsOnCard(CAGE)).toEqual({})
        expect(notes).toBeUndefined()
        // R-5.5.6 — half killed, the rest still on their own board.
        expect(s.getPlayerState(ME).warbandsOnBoard[ME]).toBe(ownForce - Math.floor(ownForce / 2))
        expect(s.getPlayerState(FOE).warbandsOnBoard[FOE]).toBe(3)
        expect(s.warbandsBySite['c1'][FOE]).toBe(3)
    })

    it('unused, R-5.5.6 sends the survivors home as ever', () => {
        const s = board({ [ME]: [CAGE] })
        campaign(s, ME, { kind: 'player', playerId: FOE }, [siteTarget('c1')])
        defend(s)
        decide(s, true, [{ at: { kind: 'board', playerId: FOE }, owner: FOE, count: 3 }])
        expect(s.warbandsOnCard(CAGE)).toEqual({})
        expect(s.warbandsBySite['c1'][FOE]).toBe(0)
        expect(s.getPlayerState(FOE).warbandsOnBoard[FOE]).toBe(3)
    })

    it('the Empire’s force (R-10.29): the defender and the Imperial Ally lose their survivors, from the site and from both boards', () => {
        const s = board({ [ME]: [CAGE] }, { [ME]: { siteId: 'p1' } })
        expectWarbandsConserved(s, () => {
            campaign(s, ME, { kind: 'player', playerId: CIT }, [siteTarget('p1')], [PLAN])
            expect(s.campaign?.allyPlayerIds).toEqual([CHAN])
            defend(s)
            decide(s, true)
        })
        // Seven Imperial warbands defend: two at p1, two and three on the boards; three die.
        expect(s.warbandsOnCard(CAGE)).toEqual({ [IMPERIAL_WARBANDS]: 4 })
        expect(s.warbandsBySite['p1'][IMPERIAL_WARBANDS]).toBe(0)
        expect(warbandsOnBoardOf(s, CIT) + warbandsOnBoardOf(s, CHAN)).toBe(0)
    })

    it('an Ally’s Cage takes the attacker’s survivors when the defending side wins', () => {
        const s = board({ [CHAN]: [CAGE] }, { [ME]: { siteId: 'p1' } })
        campaign(s, ME, { kind: 'player', playerId: CIT }, [siteTarget('p1')])
        defend(s, { [CHAN]: [PLAN] })
        const attackingForce = required(s.getPlayerState(ME).warbandsOnBoard[ME], 'my red warbands')
        decide(s, false)
        expect(s.warbandsOnCard(CAGE)).toEqual({ [ME]: attackingForce - Math.floor(attackingForce / 2) })
        expect(s.getPlayerState(ME).warbandsOnBoard[ME]).toBe(0)
    })

    it('bandits in an enemy force are never moved (R-7.6.5, R-10.3): only the warbands reach the Cage', () => {
        const s = board({ [ME]: [CAGE], [FOE]: [CROWN] })
        expectWarbandsConserved(s, () => {
            campaign(s, ME, { kind: 'player', playerId: FOE }, [siteTarget('c1')], [PLAN])
            defend(s)
            expect(s.campaign?.defendingBandits).toBe(1)
            decide(s, true)
        })
        // Six warbands and a bandit: half of seven die, and the three warbands left are caged.
        expect(s.warbandsOnCard(CAGE)).toEqual({ [FOE]: 3 })
        const t = board({ [ME]: [CAGE] }, { [ME]: { siteId: 'h1' } })
        campaign(t, ME, { kind: 'bandits' }, [siteTarget('h1')], [PLAN])
        const notes = decide(t, true).metadata?.planNotes
        expect(notes).toEqual([`Obsidian Cage: ${ME} moved the enemy's 0 unkilled warbands to the Cage`])
        expect(t.warbandsOnCard(CAGE)).toEqual({})
    })

    it('caged warbands are on no board and at no site: they rule nothing and join no force', () => {
        const s = board({ [ME]: [CAGE] }, { [FOE]: { warbandsOnBoard: {} } }, { warbandsBySite: { c2: { [ME]: 1 } }, ...caged({ [FOE]: 6 }) })
        expect(rulesSite(s, FOE, 'c1')).toBe(false)
        expect(warbandsOnBoardOf(s, FOE)).toBe(0)
        campaign(s, ME, { kind: 'player', playerId: FOE }, [{ kind: CampaignTargetKind.PawnAndFavor }])
        expect(s.campaign?.defendingForce ?? []).toEqual([])
    })
})

describe('Obsidian Cage — "Action: Move any number of warbands from Obsidian Cage to any board of the same color"', () => {
    it('any board of the same color: an Exile\'s own board, and for the Empire\'s every Imperial board (R-6.6.3)', () => {
        const s = board({ [ME]: [CAGE] }, {}, caged({ [FOE]: 3, [IMPERIAL_WARBANDS]: 4, [CIT]: 1, [ME]: 0 }))
        const [{ options }] = legalChoices(s, ME, powersWithTiming(CAGE, PowerTiming.Action)[0])
        expect(options).toEqual([boardWarbands(FOE, FOE, 3), boardWarbands(CHAN, IMPERIAL_WARBANDS, 4), boardWarbands(CIT, IMPERIAL_WARBANDS, 4), boardWarbands(CIT, CIT, 1)])
    })

    it('moves them to the boards named, any number of each, for no cost', () => {
        const s = board({ [ME]: [CAGE] }, {}, caged({ [FOE]: 3, [IMPERIAL_WARBANDS]: 4 }))
        let summary: string | undefined
        expectWarbandsConserved(s, () => {
            summary = useAction(s, ME, [boardWarbands(FOE, FOE, 2), boardWarbands(CHAN, IMPERIAL_WARBANDS, 3), boardWarbands(CIT, IMPERIAL_WARBANDS, 1)]).metadata?.summary
        })
        expect(s.warbandsOnCard(CAGE)).toEqual({ [FOE]: 1, [IMPERIAL_WARBANDS]: 0 })
        expect(s.getPlayerState(FOE).warbandsOnBoard[FOE]).toBe(5)
        expect(s.getPlayerState(CHAN).warbandsOnBoard[IMPERIAL_WARBANDS]).toBe(6)
        expect(s.getPlayerState(CIT).warbandsOnBoard[IMPERIAL_WARBANDS]).toBe(3)
        expect(summary).toBe("Obsidian Cage: moved 6 warbands from the Cage to their owners' boards")
        expect(s.getPlayerState(ME)).toMatchObject({ favor: 4, secrets: 2, supply: 6 })
        expect(s.tokensOn(CAGE)).toEqual({ favor: 0, secrets: 0 })
    })

    it('a board of another owner is refused, and so is an owner the Cage does not hold', () => {
        const s = board({ [ME]: [CAGE] }, {}, caged({ [FOE]: 3 }))
        expect(reasonCannotUse(s, ME, [boardWarbands(ME, FOE, 1)])).toMatch(/1 of foe's warbands is not among the options/)
        expect(reasonCannotUse(s, ME, [boardWarbands(ME, ME, 1)])).toMatch(/1 of me's warbands is not among the options/)
        expect(reasonCannotUse(s, ME, [{ kind: PowerChoiceKind.Warbands, group: { at: { kind: 'site', siteId: 'c2' }, owner: FOE, count: 1 } }])).toMatch(/not among the options/)
    })

    it('no more than the Cage holds, whether to one board or split across the Imperial ones; and at least one', () => {
        const s = board({ [ME]: [CAGE] }, {}, caged({ [FOE]: 3, [IMPERIAL_WARBANDS]: 4 }))
        expect(reasonCannotUse(s, ME, [boardWarbands(FOE, FOE, 4)])).toMatch(/4 of foe's warbands chosen .* but only 3 are there/)
        expect(reasonCannotUse(s, ME, [boardWarbands(CHAN, IMPERIAL_WARBANDS, 3), boardWarbands(CIT, IMPERIAL_WARBANDS, 2)])).toBe('the Obsidian Cage holds 4 Imperial warbands, not 5')
        expect(reasonCannotUse(s, ME, [boardWarbands(CHAN, IMPERIAL_WARBANDS, 3), boardWarbands(CIT, IMPERIAL_WARBANDS, 1)])).toBeUndefined()
        expect(reasonCannotUse(s, ME, [boardWarbands(FOE, FOE, 0)])).toMatch(/at least one warband must be chosen/)
        expect(reasonCannotUse(s, ME, [])).toMatch(/no choice was made for warbands on the Obsidian Cage/)
        expect(reasonCannotUse(s, ME, [boardWarbands(FOE, FOE, 1), boardWarbands(FOE, FOE, 1)])).toMatch(/chosen twice/)
    })

    it('an empty Cage offers nothing to move', () => {
        const s = board({ [ME]: [CAGE] })
        expect(legalChoices(s, ME, powersWithTiming(CAGE, PowerTiming.Action)[0])[0].options).toEqual([])
        expect(reasonCannotUse(s, ME, [boardWarbands(FOE, FOE, 1)])).toMatch(/not among the options/)
    })

    it('when the relic changes hands the warbands stay on it, and the Action is its new holder’s', () => {
        const s = board({ [FOE]: [CAGE] }, {}, caged({ [FOE]: 3 }), FOE)
        expect(s.warbandsOnCard(CAGE)).toEqual({ [FOE]: 3 })
        expect(legalPowers(s, FOE, PowerTiming.Action).map((p) => p.cardId)).toContain(CAGE)
        expect(legalPowers(s, ME, PowerTiming.Action).map((p) => p.cardId)).not.toContain(CAGE)
        expect(reasonCannotUse(s, ME, [boardWarbands(FOE, FOE, 3)])).toBeDefined()
        useAction(s, FOE, [boardWarbands(FOE, FOE, 3)])
        expect(s.getPlayerState(FOE).warbandsOnBoard[FOE]).toBe(6)
    })
})

describe("Obsidian Cage — a caged player who is now a Citizen gets the Empire's warbands back (its Q&A, R-6.6.2)", () => {
    const current = (over: Record<string, number>, chancellorBank = 8) =>
        board({ [ME]: [CAGE] }, { [CHAN]: { warbandsInPersonalBank: { [IMPERIAL_WARBANDS]: chancellorBank } } }, { ...caged(over), oathRevision: OathRevision.EngineFixes2 })

    it("their own go back to their bank and as many Imperial warbands come from the Chancellor's bank", () => {
        const s = current({ [CIT]: 3 })
        let action: HydratedUseActionPower | undefined
        expectWarbandsConserved(s, () => {
            action = useAction(s, ME, [boardWarbands(CIT, CIT, 3)])
        })
        expect(s.warbandsOnCard(CAGE)).toEqual({ [CIT]: 0 })
        expect(s.getPlayerState(CIT).warbandsOnBoard).toEqual({ [IMPERIAL_WARBANDS]: 5 })
        expect(s.getPlayerState(CIT).warbandsInPersonalBank[CIT]).toBe(17)
        expect(s.getPlayerState(CHAN).warbandsInPersonalBank[IMPERIAL_WARBANDS]).toBe(5)
        expect(action?.metadata?.summary).toBe("Obsidian Cage: 3 of cit's warbands went back to cit's bank and 3 Imperial warbands came from the Chancellor's bank in their place")
        expect(action?.metadata?.warbandOwner).toBeUndefined()
    })

    it("as Muster does, a short Chancellor's bank gives as many as it holds (R-9.3); the warbands moved as they are are the summary's own", () => {
        const s = current({ [CIT]: 3, [FOE]: 2 }, 1)
        const metadata = useAction(s, ME, [boardWarbands(CIT, CIT, 3), boardWarbands(FOE, FOE, 2)]).metadata
        expect(metadata?.summary).toBe("Obsidian Cage: moved 2 of foe's warbands from the Cage to their owners' boards; 3 of cit's warbands went back to cit's bank and 1 Imperial warband came from the Chancellor's bank in their place")
        expect(metadata?.warbandOwner).toBe(FOE)
        expect(s.getPlayerState(CIT).warbandsOnBoard).toEqual({ [IMPERIAL_WARBANDS]: 3 })
        expect(s.getPlayerState(CIT).warbandsInPersonalBank[CIT]).toBe(17)
        expect(s.getPlayerState(CHAN).warbandsInPersonalBank[IMPERIAL_WARBANDS]).toBe(0)
    })

    it("an Exile's and the Empire's caged warbands come back as before", () => {
        const s = current({ [FOE]: 2, [IMPERIAL_WARBANDS]: 1 })
        const metadata = useAction(s, ME, [boardWarbands(FOE, FOE, 2), boardWarbands(CIT, IMPERIAL_WARBANDS, 1)]).metadata
        expect(metadata?.summary).toBe("Obsidian Cage: moved 2 of foe's warbands and 1 Imperial warband from the Cage to their owners' boards")
        expect(s.getPlayerState(FOE).warbandsOnBoard[FOE]).toBe(5)
        expect(s.getPlayerState(CIT).warbandsOnBoard).toEqual({ [IMPERIAL_WARBANDS]: 3 })
        expect(s.getPlayerState(CHAN).warbandsInPersonalBank[IMPERIAL_WARBANDS]).toBe(8)
    })

    it('R-10.13 — groups of several owners are counted by owner, so each draws in its own colour; the Empire’s on two boards once', () => {
        const s = current({ [FOE]: 3, [IMPERIAL_WARBANDS]: 4 })
        const metadata = useAction(s, ME, [boardWarbands(FOE, FOE, 2), boardWarbands(CHAN, IMPERIAL_WARBANDS, 3), boardWarbands(CIT, IMPERIAL_WARBANDS, 1)]).metadata
        expect(metadata?.summary).toBe("Obsidian Cage: moved 2 of foe's warbands and 4 Imperial warbands from the Cage to their owners' boards")
        expect(metadata?.warbandOwner).toBeUndefined()
    })

    it('one owner’s are named too', () => {
        const s = current({ [FOE]: 3 })
        expect(useAction(s, ME, [boardWarbands(FOE, FOE, 1)]).metadata?.summary).toBe("Obsidian Cage: moved 1 of foe's warbands from the Cage to their owners' boards")
    })

    it.each([undefined, OathRevision.TurnFlow, OathRevision.CostsAndFacedownModifiers, OathRevision.PlanCostsAndSearchPlays, OathRevision.CardFixes1])("in a game created at revision %s they come back in the player's own colour, as recorded", (oathRevision) => {
        const s = board({ [ME]: [CAGE] }, {}, { ...caged({ [CIT]: 3 }), ...(oathRevision === undefined ? {} : { oathRevision }) })
        const metadata = useAction(s, ME, [boardWarbands(CIT, CIT, 3)]).metadata
        expect(metadata?.summary).toBe("Obsidian Cage: moved 3 warbands from the Cage to their owners' boards")
        expect(metadata?.warbandOwner).toBe(CIT)
        expect(s.getPlayerState(CIT).warbandsOnBoard).toEqual({ [IMPERIAL_WARBANDS]: 2, [CIT]: 3 })
        expect(s.getPlayerState(CIT).warbandsInPersonalBank[CIT]).toBe(14)
        expect(s.getPlayerState(CHAN).warbandsInPersonalBank[IMPERIAL_WARBANDS]).toBe(8)
    })
})

describe('Obsidian Cage — leaving play (R-10.13: a card cannot carry warbands out of play)', () => {
    const FAE = 'denizen.beast.fae-merchant'
    const DRUM = 'relic.dragonskin-drum'
    const AT_17 = { oathRevision: OathRevision.EngineFixes13 }
    /** Me, holding the Cage and Fae Merchant, has drawn the Drum; the question is mine. */
    function faeTable(cagedOver: Record<string, number>, over: Record<string, Record<string, unknown>> = {}, state: Record<string, unknown> = AT_17, held: string[] = [CAGE]) {
        const s = board({ [ME]: held }, { ...over, [ME]: { advisers: [{ cardId: FAE, faceUp: true }], ...over[ME] } }, { ...caged(cagedOver), ...state })
        s.vault = createOathVault({ discardPiles: { cradle: [], provinces: [], hinterland: [] }, composeWorldDeck: () => [] }, getPrng(1))
        s.requireVault().relicDeck = [DRUM]
        actionPowerUse(ME, FAE).apply(s)
        return s
    }
    const sendDown = (cagePlacement?: CagePlacement) => ({ kind: PowerQuestionKind.BottomRelic as const, heldRelicCardId: CAGE, ...(cagePlacement ? { cagePlacement } : {}) })
    const sendCageDown = (s: Board, cagePlacement?: CagePlacement) => answerQuestion(s, ME, sendDown(cagePlacement))
    const reasonCannotSend = (s: Board, cagePlacement?: CagePlacement) => HydratedAnswerQuestion.reasonCannotAnswer(s, ME, sendDown(cagePlacement))
    const onBoard = (s: Board, playerId: string, owner: string) => s.getPlayerState(playerId).warbandsOnBoard[owner] ?? 0
    const inBank = (s: Board, playerId: string, owner: string) => s.getPlayerState(playerId).warbandsInPersonalBank[owner] ?? 0
    const ONE_BOARD_EACH = 'the Obsidian Cage’s warbands each have one board to go to'
    const NOT_THE_CAGE = 'only the Obsidian Cage sent down places warbands'

    describe('from revision 17 (R-X.4), its Q&A: "the player who holds it must return all the warbands as described on its Action power"', () => {
        it("an Exile's caged warbands go back to that Exile's board, not their bank, and nobody is asked where", () => {
            const s = faeTable({ [FOE]: 3 }, { [FOE]: { warbandsOnBoard: { [FOE]: 1 } } })
            expect(cagePurpleChoiceBoards(s)).toEqual([])
            let action: HydratedAnswerQuestion | undefined
            expectWarbandsConserved(s, () => (action = sendCageDown(s)))
            expect(s.getPlayerState(ME).relicIds).toEqual([DRUM])
            expect(s.warbandsOnCard(CAGE)).toEqual({ [FOE]: 0 })
            expect({ board: onBoard(s, FOE, FOE), bank: inBank(s, FOE, FOE) }).toEqual({ board: 4, bank: 5 })
            expect(action?.metadata?.summary).toBe(`took ${DRUM} and put ${CAGE} on the bottom of the relic deck; its warbands went back: 3 to foe's board`)
            expect(action?.revealsInfo).toBe(true)
            // R-2.11-H1 — no Oath's goal counts warbands on a board, so the return is no title moment.
            expect(action?.metadata?.titleMoment).toBeUndefined()
        })

        it("a caged player who is now a Citizen gets Imperial warbands on their board from the Chancellor's bank; their own go back to their bank", () => {
            const s = faeTable({ [CIT]: 3 })
            expect(cagePurpleChoiceBoards(s)).toEqual([])
            let action: HydratedAnswerQuestion | undefined
            expectWarbandsConserved(s, () => (action = sendCageDown(s)))
            expect(s.getPlayerState(CIT).warbandsOnBoard).toEqual({ [IMPERIAL_WARBANDS]: 5 })
            expect(inBank(s, CIT, CIT)).toBe(17)
            expect(inBank(s, CHAN, IMPERIAL_WARBANDS)).toBe(5)
            expect(action?.metadata?.summary).toBe(`took ${DRUM} and put ${CAGE} on the bottom of the relic deck; 3 of cit's warbands went back to cit's bank and 3 Imperial warbands came from the Chancellor's bank in their place`)
        })

        it.each([[1, 1], [0, 0]])("…as far as the Chancellor's bank goes (R-9.3): a bank of %s gives %s", (chancellorBank, gained) => {
            const s = faeTable({ [CIT]: 3 }, { [CHAN]: { warbandsInPersonalBank: { [IMPERIAL_WARBANDS]: chancellorBank } } })
            expectWarbandsConserved(s, () => sendCageDown(s))
            expect(s.getPlayerState(CIT).warbandsOnBoard).toEqual({ [IMPERIAL_WARBANDS]: 2 + gained })
            expect(inBank(s, CIT, CIT)).toBe(17)
            expect(inBank(s, CHAN, IMPERIAL_WARBANDS)).toBe(0)
            expect(s.warbandsOnCard(CAGE)).toEqual({ [CIT]: 0 })
        })

        it('a caged player who is an Exile again gets their own warbands back on their board, as the Action gives them', () => {
            const s = faeTable({ [CIT]: 2 }, { [CIT]: { status: PlayerStatus.Exile, warbandsOnBoard: { [CIT]: 1 } } })
            expectWarbandsConserved(s, () => sendCageDown(s))
            expect(s.getPlayerState(CIT).warbandsOnBoard).toEqual({ [CIT]: 3 })
            expect(inBank(s, CIT, CIT)).toBe(14)
            expect(inBank(s, CHAN, IMPERIAL_WARBANDS)).toBe(8)
        })

        it("the Empire's warbands with the Chancellor's the only Imperial board go there, with no placement asked; a placement is refused", () => {
            const s = faeTable({ [IMPERIAL_WARBANDS]: 2 }, { [CIT]: { status: PlayerStatus.Exile, warbandsOnBoard: { [CIT]: 2 } } })
            expect(cagePurpleChoiceBoards(s)).toEqual([])
            expect(reasonCannotSend(s, [{ playerId: CHAN, count: 2 }])).toBe(ONE_BOARD_EACH)
            expectWarbandsConserved(s, () => sendCageDown(s))
            expect(onBoard(s, CHAN, IMPERIAL_WARBANDS)).toBe(5)
            expect(inBank(s, CHAN, IMPERIAL_WARBANDS)).toBe(8)
        })

        it.each([
            ['1 and 1', [{ playerId: CHAN, count: 1 }, { playerId: CIT, count: 1 }], 4, 3],
            ['both to the Chancellor', [{ playerId: CHAN, count: 2 }], 5, 2],
            ['both to the Citizen', [{ playerId: CIT, count: 2 }], 3, 4]
        ])('the Empire’s warbands with two Imperial boards: the holder places them, any split that returns them all (R-10.13-H1): %s', (_, placement, chan, cit) => {
            const s = faeTable({ [IMPERIAL_WARBANDS]: 2 })
            expect(cagePurpleChoiceBoards(s)).toEqual([CHAN, CIT])
            expect(reasonCannotSend(s, placement)).toBeUndefined()
            expectWarbandsConserved(s, () => sendCageDown(s, placement))
            expect([onBoard(s, CHAN, IMPERIAL_WARBANDS), onBoard(s, CIT, IMPERIAL_WARBANDS)]).toEqual([chan, cit])
            expect(inBank(s, CHAN, IMPERIAL_WARBANDS)).toBe(8)
            expect(s.warbandsOnCard(CAGE)).toEqual({ [IMPERIAL_WARBANDS]: 0 })
        })

        it("…all 24 of the Empire's warbands caged go to one board in a single answer, as the answer schema takes it", () => {
            const empty = { warbandsOnBoard: {}, warbandsInPersonalBank: { [IMPERIAL_WARBANDS]: 0 } }
            const s = faeTable({ [IMPERIAL_WARBANDS]: CHANCELLOR_WARBANDS }, { [CHAN]: empty, [CIT]: { warbandsOnBoard: {} } }, { ...AT_17, warbandsBySite: { c1: { [FOE]: 3 }, c2: { [ME]: 1 }, p1: {} } })
            expect(cagePurpleChoiceBoards(s)).toEqual([CHAN, CIT])
            const placement = [{ playerId: CIT, count: CHANCELLOR_WARBANDS }]
            expect(reasonCannotSend(s, placement)).toBeUndefined()
            expectWarbandsConserved(s, () => sendCageDown(s, placement))
            expect([onBoard(s, CHAN, IMPERIAL_WARBANDS), onBoard(s, CIT, IMPERIAL_WARBANDS)]).toEqual([0, CHANCELLOR_WARBANDS])
            expect(s.warbandsOnCard(CAGE)).toEqual({ [IMPERIAL_WARBANDS]: 0 })
        })

        it('…and a placement that is missing, short, over, twice to one board, to a board that is not Imperial or of no whole warband is refused', () => {
            const s = faeTable({ [IMPERIAL_WARBANDS]: 2 })
            expect(reasonCannotSend(s)).toBe('place the Obsidian Cage’s 2 Imperial warbands on Imperial boards')
            expect(reasonCannotSend(s, [{ playerId: CHAN, count: 1 }])).toBe('place all 2 of the Obsidian Cage’s Imperial warbands, not 1')
            expect(reasonCannotSend(s, [{ playerId: CHAN, count: 2 }, { playerId: CIT, count: 1 }])).toBe('place all 2 of the Obsidian Cage’s Imperial warbands, not 3')
            expect(reasonCannotSend(s, [{ playerId: CHAN, count: 1 }, { playerId: CHAN, count: 1 }])).toBe(`${CHAN}'s board is named twice`)
            expect(reasonCannotSend(s, [{ playerId: FOE, count: 2 }])).toBe(`${FOE}'s board is not an Imperial board`)
            expect(reasonCannotSend(s, [{ playerId: 'nobody', count: 2 }])).toBe("nobody's board is not an Imperial board")
            // Outside the answer schema's counts: the check refuses them on its own, as the client runs it.
            expect(reasonCannotSend(s, [{ playerId: CHAN, count: 3 }, { playerId: CIT, count: -1 }])).toBe(`${CIT}'s board is named for -1 warbands; a board named takes at least 1`)
            expect(reasonCannotSend(s, [{ playerId: CHAN, count: 2 }, { playerId: CIT, count: 0 }])).toBe(`${CIT}'s board is named for 0 warbands; a board named takes at least 1`)
            expect(reasonCannotSend(s, [{ playerId: CHAN, count: 1.5 }, { playerId: CIT, count: 0.5 }])).toBe(`${CHAN}'s board is named for 1.5 warbands; a board named takes at least 1`)
            expect(() => sendCageDown(s, [{ playerId: FOE, count: 2 }])).toThrow(/not an Imperial board/)
            expect(s.warbandsOnCard(CAGE)).toEqual({ [IMPERIAL_WARBANDS]: 2 })
        })

        it("every owner's group at once: each to its board, the Empire's as placed, and the History names each board", () => {
            const s = faeTable({ [FOE]: 3, [IMPERIAL_WARBANDS]: 2, [CIT]: 1 })
            let action: HydratedAnswerQuestion | undefined
            expectWarbandsConserved(s, () => (action = sendCageDown(s, [{ playerId: CIT, count: 1 }, { playerId: CHAN, count: 1 }])))
            expect(s.warbandsOnCard(CAGE)).toEqual({ [FOE]: 0, [IMPERIAL_WARBANDS]: 0, [CIT]: 0 })
            expect(onBoard(s, FOE, FOE)).toBe(6)
            expect(onBoard(s, CHAN, IMPERIAL_WARBANDS)).toBe(4)
            expect(s.getPlayerState(CIT).warbandsOnBoard).toEqual({ [IMPERIAL_WARBANDS]: 4 })
            expect(inBank(s, CIT, CIT)).toBe(15)
            expect(inBank(s, CHAN, IMPERIAL_WARBANDS)).toBe(7)
            expect(action?.metadata?.summary).toBe(`took ${DRUM} and put ${CAGE} on the bottom of the relic deck; its warbands went back: 3 to foe's board, 1 to chan's board, 1 to cit's board; 1 of cit's warbands went back to cit's bank and 1 Imperial warband came from the Chancellor's bank in their place`)
        })

        it('another held relic sent down, or the drawn one, leaves the Cage and its warbands with the holder; a placement there is refused', () => {
            const s = faeTable({ [IMPERIAL_WARBANDS]: 2 }, {}, AT_17, [CAGE, CROWN])
            const placement = [{ playerId: CHAN, count: 2 }]
            expect(HydratedAnswerQuestion.reasonCannotAnswer(s, ME, { kind: PowerQuestionKind.BottomRelic, heldRelicCardId: CROWN, cagePlacement: placement })).toBe(NOT_THE_CAGE)
            expect(HydratedAnswerQuestion.reasonCannotAnswer(s, ME, { kind: PowerQuestionKind.BottomRelic, cagePlacement: placement })).toBe(NOT_THE_CAGE)
            answerQuestion(s, ME, { kind: PowerQuestionKind.BottomRelic, heldRelicCardId: CROWN })
            expect(s.getPlayerState(ME).relicIds).toEqual([CAGE, DRUM])
            expect(s.warbandsOnCard(CAGE)).toEqual({ [IMPERIAL_WARBANDS]: 2 })
        })

        it("the placement's boards and its check read only what the holder's own view serves, and agree with the host's", () => {
            const s = faeTable({ [FOE]: 1, [IMPERIAL_WARBANDS]: 2 })
            const view = { kind: 'player' as const, playerId: ME }
            const before = JSON.stringify(served(s, view))
            // The guard throws on any read of a host-only or another player's hidden value.
            const guarded = OathVisibility.state.guardForExecution(new HydratedOathGameState(served(s, view)), view)
            const own = new HydratedOathGameState(served(s, view))
            const placements = [undefined, [{ playerId: CHAN, count: 2 }], [{ playerId: CHAN, count: 1 }], [{ playerId: CIT, count: 1 }, { playerId: CHAN, count: 1 }], [{ playerId: FOE, count: 2 }]]
            expect(cagePurpleChoiceBoards(guarded)).toEqual([CHAN, CIT])
            expect(cagePurpleChoiceBoards(guarded)).toEqual(cagePurpleChoiceBoards(s))
            for (const placement of placements) {
                expect(reasonCagePlacementInvalid(guarded, placement)).toBe(reasonCagePlacementInvalid(s, placement))
                expect(HydratedAnswerQuestion.reasonCannotAnswer(own, ME, sendDown(placement))).toBe(reasonCannotSend(s, placement))
            }
            expect(JSON.stringify(served(s, view))).toBe(before)
        })
    })

    it.each([undefined, OathRevision.EngineFixes2, OathRevision.EngineFixes12])("in a game created at revision %s every caged warband returns to its bank, the Empire's to the Chancellor, as recorded; a placement is refused", (oathRevision) => {
        const s = faeTable({ [FOE]: 3, [IMPERIAL_WARBANDS]: 2, [CIT]: 1 }, {}, oathRevision === undefined ? {} : { oathRevision })
        expect(cagePurpleChoiceBoards(s)).toEqual([])
        expect(reasonCannotSend(s, [{ playerId: CHAN, count: 2 }])).toBe(ONE_BOARD_EACH)
        let action: HydratedAnswerQuestion | undefined
        expectWarbandsConserved(s, () => (action = sendCageDown(s)))
        expect(s.getPlayerState(ME).relicIds).toEqual([DRUM])
        expect(s.warbandsOnCard(CAGE)).toEqual({ [FOE]: 0, [IMPERIAL_WARBANDS]: 0, [CIT]: 0 })
        expect(inBank(s, FOE, FOE)).toBe(8)
        expect(inBank(s, CHAN, IMPERIAL_WARBANDS)).toBe(10)
        expect(inBank(s, CIT, CIT)).toBe(15)
        expect(s.getPlayerState(CIT).warbandsOnBoard[IMPERIAL_WARBANDS]).toBe(2)
        expect(action?.metadata?.summary).toBe(`took ${DRUM} and put ${CAGE} on the bottom of the relic deck`)
    })
})
