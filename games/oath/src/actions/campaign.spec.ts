import { beforeAll, describe, expect, it } from 'vitest'
import { Color } from '@tabletop/common'
import { CardKind, IMPERIAL_COLOR, PlayerStatus } from '../model/oathEnums.js'
import { registerCards } from '../data/cardRegistry.js'
import { CampaignTargetKind } from '../model/campaign.js'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import { testPlayer, testState } from '../testing/fixture.js'
import { expectWarbandsConserved } from '../testing/census.js'
import { expectFavorConserved } from '../testing/census.js'
import { CAMPAIGN_SUPPLY_COST, HydratedCampaign, Campaign } from './campaign.js'
import { forceTotal } from '../util/force.js'
import { CampaignSacrificeStateHandler } from '../stateHandlers/campaigning.js'
import { machineContext, buildAction, answerConsent } from '../testing/actions.js'
import { siteTarget } from '../testing/choices.js'
import { ATTACKER, DEFENDER, campaign } from '../testing/steps.js'
import { ConsentRequestKind } from '../model/consent.js'

const CHANCELLOR = 'chancellor'
const CITIZEN = 'citizen'

beforeAll(() => {
    registerCards([
        { id: 'relic.crown', name: 'Crown', kind: CardKind.Relic, defenseDice: 2 }
    ])
})

function table(overrides: Record<string, unknown> = {}) {
    return testState(
        [
            testPlayer({
                playerId: ATTACKER,
                color: Color.Red,
                status: PlayerStatus.Exile,
                siteId: 'c1',
                supply: 7,
                warbandsOnBoard: { [Color.Red]: 5 },
                warbandsInPersonalBank: { [Color.Red]: 7 }
            }),
            testPlayer({
                playerId: DEFENDER,
                color: Color.Yellow,
                status: PlayerStatus.Exile,
                siteId: 'p1',
                favor: 6,
                warbandsOnBoard: { [Color.Yellow]: 4 },
                warbandsInPersonalBank: { [Color.Yellow]: 6 }
            }),
            testPlayer({
                playerId: CHANCELLOR,
                color: Color.Purple,
                status: PlayerStatus.Chancellor,
                siteId: 'h1',
                warbandsOnBoard: { [IMPERIAL_COLOR]: 6 },
                warbandsInPersonalBank: { [IMPERIAL_COLOR]: 15 }
            }),
            testPlayer({
                playerId: CITIZEN,
                color: Color.Blue,
                status: PlayerStatus.Citizen,
                siteId: 'h2',
                warbandsOnBoard: { [IMPERIAL_COLOR]: 3 },
                warbandsInPersonalBank: { [Color.Blue]: 14 }
            })
        ],
        {
            chancellorPlayerId: CHANCELLOR,
            // R-5.5.1 — the defender's warband at c1 is what makes them a legal target.
            warbandsBySite: {
                c1: { [Color.Yellow]: 1 },
                p1: { [Color.Yellow]: 3 }
            },
            prng: { seed: 1, invocations: 0 },
            ...overrides
        }
    )
}

describe('Campaign step 1 (R-5.5.1)', () => {
    it('spends two Supply', () => {
        const state = table()
        campaign().apply(state)

        const attacker = state.getPlayerState(ATTACKER)
        expect(attacker.supply).toBe(7 - CAMPAIGN_SUPPLY_COST)
        expect(attacker.supplySpentThisTurn).toBe(CAMPAIGN_SUPPLY_COST)
        expect(CAMPAIGN_SUPPLY_COST).toBe(2)
    })

    it('refuses when the attacker cannot afford the Supply', () => {
        const state = table()
        state.getPlayerState(ATTACKER).supply = 1
        expect(() => campaign().apply(state)).toThrow(/costs 2 Supply/)
    })

    it('refuses a defender who neither rules your site nor stands at it', () => {
        const state = table()
        expect(() =>
            campaign({ defender: { kind: 'player', playerId: CHANCELLOR } }).apply(state)
        ).toThrow(/neither rules your site nor has a pawn there/)
    })

    it('accepts a defender whose pawn is at your site even if they rule nothing', () => {
        const state = table({
            warbandsBySite: { c1: { [Color.Red]: 2 }, p1: { [Color.Yellow]: 3 } }
        })
        state.getPlayerState(DEFENDER).siteId = 'c1'

        expect(() =>
            campaign({ targets: [{ kind: CampaignTargetKind.PawnAndFavor }] }).apply(state)
        ).not.toThrow()
    })

    it('refuses to attack yourself', () => {
        const state = table()
        expect(() =>
            campaign({ defender: { kind: 'player', playerId: ATTACKER } }).apply(state)
        ).toThrow(/any one other player/)
    })

    it('offers the bandits only when no player rules your site (R-5.5.1)', () => {
        const state = table()
        expect(() =>
            campaign({ defender: { kind: 'bandits' } }).apply(state)
        ).toThrow(/a player rules your site/)
    })

    it('accepts the bandits at a site nobody rules', () => {
        const state = table()
        state.getPlayerState(ATTACKER).siteId = 'h3'

        expect(() =>
            campaign({ defender: { kind: 'bandits' }, targets: [siteTarget('h3')] }).apply(state)
        ).not.toThrow()
        expect(state.campaign?.defenderPlayerId).toBeUndefined()
    })
})

describe('Campaign-scoped Imperial status (R-5.5.1.a)', () => {
    it('suspends a Citizen attacking the Chancellor', () => {
        const state = table()
        state.getPlayerState(CITIZEN).siteId = 'c1'
        state.getPlayerState(CHANCELLOR).siteId = 'c1'

        new HydratedCampaign(
            buildAction(Campaign, {
                playerId: CITIZEN,
                defender: { kind: 'player', playerId: CHANCELLOR },
                targets: [{ kind: CampaignTargetKind.PawnAndFavor }],
                attackDice: 1,
            })
        ).apply(state)

        expect(state.campaign?.nonImperialPlayerIds).toEqual([CITIZEN])
    })

    it('suspends a Citizen the Chancellor attacks', () => {
        const state = table()
        state.getPlayerState(CHANCELLOR).siteId = 'c1'
        state.getPlayerState(CITIZEN).siteId = 'c1'

        new HydratedCampaign(
            buildAction(Campaign, {
                playerId: CHANCELLOR,
                defender: { kind: 'player', playerId: CITIZEN },
                targets: [{ kind: CampaignTargetKind.PawnAndFavor }],
                attackDice: 1,
            })
        ).apply(state)

        expect(state.campaign?.nonImperialPlayerIds).toEqual([CITIZEN])
    })

    it('suspends a Citizen attacking another Citizen (R-5.5.1.a)', () => {
        const state = testState(
            [
                testPlayer({
                    playerId: CITIZEN,
                    color: Color.Blue,
                    status: PlayerStatus.Citizen,
                    siteId: 'c1',
                    supply: 7,
                    warbandsOnBoard: { [IMPERIAL_COLOR]: 5 },
                    warbandsInPersonalBank: { [Color.Blue]: 9 }
                }),
                testPlayer({
                    playerId: 'citizen2',
                    color: Color.Black,
                    status: PlayerStatus.Citizen,
                    siteId: 'c1',
                    favor: 4,
                    warbandsOnBoard: { [IMPERIAL_COLOR]: 3 },
                    warbandsInPersonalBank: { [Color.Black]: 11 }
                }),
                testPlayer({
                    playerId: CHANCELLOR,
                    color: Color.Purple,
                    status: PlayerStatus.Chancellor,
                    siteId: 'h1',
                    warbandsOnBoard: { [IMPERIAL_COLOR]: 6 },
                    warbandsInPersonalBank: { [IMPERIAL_COLOR]: 15 }
                })
            ],
            { chancellorPlayerId: CHANCELLOR, prng: { seed: 1, invocations: 0 } }
        )

        new HydratedCampaign(
            buildAction(Campaign, {
                playerId: CITIZEN,
                defender: { kind: 'player', playerId: 'citizen2' },
                targets: [{ kind: CampaignTargetKind.PawnAndFavor }],
                attackDice: 1,
            })
        ).apply(state)

        expect(state.campaign?.nonImperialPlayerIds).toEqual([CITIZEN])

        // R-5.5.2.a — the defender stays Imperial, so the Chancellor joins them unprompted.
        expect(state.campaign?.allyPlayerIds).toContain(CHANCELLOR)
        expect(state.campaign?.allyPlayerIds).not.toContain(CITIZEN)
    })

    it('suspends nobody in an Exile-on-Exile Campaign', () => {
        const state = table()
        campaign().apply(state)
        expect(state.campaign?.nonImperialPlayerIds).toEqual([])
    })
})

describe('Allies (R-5.5.2.a)', () => {
    it('brings the Chancellor in automatically when an Imperial player defends', () => {
        const state = table()
        state.getPlayerState(CITIZEN).siteId = 'c1'

        campaign({
            defender: { kind: 'player', playerId: CITIZEN },
            targets: [{ kind: CampaignTargetKind.PawnAndFavor }]
        }).apply(state)

        expect(state.campaign?.allyPlayerIds).toContain(CHANCELLOR)
    })

    it('brings nobody in when an Exile defends', () => {
        const state = table()
        campaign().apply(state)
        expect(state.campaign?.allyPlayerIds).toEqual([])
    })

    function chancellorDefendsWithCitizenAt(siteId: string) {
        const state = table()
        state.getPlayerState(CHANCELLOR).siteId = 'c1'
        state.getPlayerState(CITIZEN).siteId = siteId
        campaign({
            defender: { kind: 'player', playerId: CHANCELLOR },
            targets: [{ kind: CampaignTargetKind.PawnAndFavor }]
        }).apply(state)
        return state
    }

    it('asks a Citizen at the attacker\'s site whether to join, and holds the Campaign until they answer', () => {
        const state = chancellorDefendsWithCitizenAt('c1')
        expect(state.campaign).toBeUndefined()
        expect(state.pendingCampaign?.toAsk).toEqual([CITIZEN])
        expect(state.pendingConsent).toMatchObject({
            request: { kind: ConsentRequestKind.JoinDefence, citizenPlayerId: CITIZEN },
            askedPlayerId: CITIZEN
        })
    })

    it('an ally the attacker writes into their own action is never read', () => {
        const state = table()
        state.getPlayerState(CHANCELLOR).siteId = 'c1'
        state.getPlayerState(CITIZEN).siteId = 'c1'
        const sent = buildAction(Campaign, {
            playerId: ATTACKER,
            defender: { kind: 'player', playerId: CHANCELLOR },
            targets: [{ kind: CampaignTargetKind.PawnAndFavor }],
            attackDice: 3
        })
        const forged = { ...sent, allies: [{ playerId: CITIZEN, defenderConsents: true }] }
        new HydratedCampaign(forged).apply(state)
        expect(state.campaign).toBeUndefined()
        expect(state.pendingConsent?.askedPlayerId).toBe(CITIZEN)
    })

    it('only the asked Citizen answers', () => {
        const state = chancellorDefendsWithCitizenAt('c1')
        expect(() => answerConsent(state, CHANCELLOR, true)).toThrow(/made to citizen, not to chancellor/)
    })

    it('a Citizen who declines stays out, and the Campaign musters without them', () => {
        const state = chancellorDefendsWithCitizenAt('c1')
        const declined = answerConsent(state, CITIZEN, false)
        expect(state.pendingConsent).toBeUndefined()
        expect(state.pendingCampaign).toBeUndefined()
        expect(state.campaign?.allyPlayerIds).not.toContain(CITIZEN)
        expect(declined.revealsInfo).toBe(true)
        expect(declined.metadata?.battle).toBeDefined()
    })

    it('a Citizen who asks to join waits on the defender\'s permission, and a refusal keeps them out (R-X.1)', () => {
        const state = chancellorDefendsWithCitizenAt('c1')
        answerConsent(state, CITIZEN, true)
        expect(state.campaign).toBeUndefined()
        expect(state.pendingConsent).toMatchObject({
            request: { kind: ConsentRequestKind.AdmitAlly, citizenPlayerId: CITIZEN },
            askedPlayerId: CHANCELLOR
        })
        answerConsent(state, CHANCELLOR, false)
        expect(state.campaign?.allyPlayerIds).not.toContain(CITIZEN)
    })

    it('admits the Citizen with the defender\'s permission', () => {
        const state = chancellorDefendsWithCitizenAt('c1')
        answerConsent(state, CITIZEN, true)
        answerConsent(state, CHANCELLOR, true)
        expect(state.campaign?.allyPlayerIds).toContain(CITIZEN)
    })

    it('asks nobody whose pawn is at neither the attacker\'s site nor a target', () => {
        const state = chancellorDefendsWithCitizenAt('h2')
        expect(state.pendingConsent).toBeUndefined()
        expect(state.campaign?.allyPlayerIds).not.toContain(CITIZEN)
    })

    it('never asks the attacker to join their enemy', () => {
        const state = table()
        state.getPlayerState(CHANCELLOR).siteId = 'c1'
        state.getPlayerState(CITIZEN).siteId = 'c1'
        campaign({
            playerId: CITIZEN,
            defender: { kind: 'player', playerId: CHANCELLOR },
            targets: [{ kind: CampaignTargetKind.PawnAndFavor }],
            attackDice: 3
        }).apply(state)
        expect(state.pendingConsent).toBeUndefined()
        expect(state.campaign?.allyPlayerIds).not.toContain(CITIZEN)
    })

    it('never asks an Exile (R-5.5.2.a admits Citizens only)', () => {
        const state = table()
        state.getPlayerState(CHANCELLOR).siteId = 'c1'
        state.getPlayerState(DEFENDER).siteId = 'c1'
        state.getPlayerState(CITIZEN).siteId = 'h2'
        campaign({
            defender: { kind: 'player', playerId: CHANCELLOR },
            targets: [{ kind: CampaignTargetKind.PawnAndFavor }]
        }).apply(state)
        expect(state.pendingConsent).toBeUndefined()
        expect(state.campaign?.allyPlayerIds).not.toContain(DEFENDER)
    })
})

describe('the attack pool (R-5.5.2)', () => {
    it('is capped by the warbands on the attacker\'s board, not the dice supply', () => {
        const state = table()
        expect(() => campaign({ attackDice: 6 }).apply(state)).toThrow(
            /at most 5 attack dice/
        )
    })

    it('allows exactly as many dice as board warbands', () => {
        const state = table()
        campaign({ attackDice: 5 }).apply(state)
        expect(state.campaign?.attackPool).toBe(5)
    })

    it('allows declaring none', () => {
        const state = table()
        campaign({ attackDice: 0 }).apply(state)
        expect(state.campaign?.attackPool).toBe(0)
        expect(state.campaign?.attackRoll).toEqual([])
    })

    it('refuses a negative pool', () => {
        const valid = buildAction(Campaign, {
            playerId: ATTACKER,
            defender: { kind: 'player', playerId: DEFENDER },
            targets: [siteTarget('c1')],
            attackDice: 3,
        })
        expect(() => new HydratedCampaign({ ...valid, attackDice: -1 })).toThrow(/at least 0|must be >= 0/)
    })
})

describe('rolling (R-5.5.4, R-5.5.5)', () => {
    it('rolls from state.prng, in apply, so every client replays it', () => {
        const state = table()
        campaign({ attackDice: 3 }).apply(state)

        expect(state.campaign?.defenseRoll).toHaveLength(1)
        expect(state.campaign?.attackRoll).toHaveLength(3)
        expect(state.prng.invocations).toBe(4)
    })

    it('is deterministic for a seed -- two runs of the same Campaign agree', () => {
        const a = table({ prng: { seed: 4242, invocations: 0 } })
        const b = table({ prng: { seed: 4242, invocations: 0 } })
        campaign().apply(a)
        campaign().apply(b)

        expect(a.campaign?.attackRoll).toEqual(b.campaign?.attackRoll)
        expect(a.campaign?.defenseRoll).toEqual(b.campaign?.defenseRoll)
        expect(a.campaign?.defense).toBe(b.campaign?.defense)
    })

    it('differs across seeds', () => {
        const seeds = [1, 2, 3, 4, 5].map((seed) => {
            const state = table({ prng: { seed, invocations: 0 } })
            campaign({ attackDice: 5 }).apply(state)
            return JSON.stringify(state.campaign?.attackRoll)
        })
        expect(new Set(seeds).size).toBeGreaterThan(1)
    })

    it('marks the action irreversible, because it advanced the PRNG (R-X.3)', () => {
        const state = table()
        const action = campaign()
        action.apply(state)
        expect(action.revealsInfo).toBe(true)
    })
})

describe('the defense total (R-5.5.4)', () => {
    it('adds the defending force to the shields rolled', () => {
        const state = table()
        campaign().apply(state)

        const campaignState = state.campaign
        const shields = campaignState?.defenseRoll.reduce((n, f) => n + f.shields, 0) ?? 0
        // Only c1 is targeted, so the defender's board at p1 stays out of the force.
        expect(forceTotal(campaignState?.defendingForce ?? [])).toBe(1)
        expect(campaignState?.defense).toBe(shields + 1)
    })

    it('counts bandits instead of warbands when attacking them (R-2.8.3)', () => {
        const state = table()
        state.getPlayerState(ATTACKER).siteId = 'h3'
        campaign({ defender: { kind: 'bandits' }, targets: [siteTarget('h3')] }).apply(state)

        expect(state.campaign?.defendingBandits).toBe(1)
        expect(state.campaign?.defendingForce).toEqual([])
    })
})

describe('skulls (R-5.5.5)', () => {
    it('kills one warband in the attacker\'s force per skull, immediately', () => {
        const seed = seedRollingSkulls(1)
        const state = table({ prng: { seed, invocations: 0 } })

        expectWarbandsConserved(state, () => campaign({ attackDice: 5 }).apply(state))

        const attacker = state.getPlayerState(ATTACKER)
        const skulls = state.campaign?.attackRoll.reduce((n, f) => n + f.skulls, 0) ?? 0
        expect(skulls).toBeGreaterThan(0)
        expect(attacker.warbandsOnBoard[Color.Red]).toBe(5 - skulls)
        expect(attacker.warbandsInPersonalBank[Color.Red]).toBe(7 + skulls)
    })

    it('still counts the two swords on the skull face', () => {
        const seed = seedRollingSkulls(1)
        const state = table({ prng: { seed, invocations: 0 } })
        campaign({ attackDice: 5 }).apply(state)

        const roll = state.campaign?.attackRoll ?? []
        const skullFaces = roll.filter((f) => f.skulls > 0)
        expect(skullFaces.every((f) => f.swords === 2)).toBe(true)
        const expected = roll.reduce((n, f) => n + f.swords, 0)
        expect(state.campaign?.swords).toBeGreaterThanOrEqual(expected)
    })

    it('sends a killed purple warband to the Chancellor (R-10.13)', () => {
        const seed = seedRollingSkulls(1)
        const state = table({ prng: { seed, invocations: 0 } })
        const citizen = state.getPlayerState(CITIZEN)
        citizen.siteId = 'c1'
        citizen.warbandsOnBoard = { [IMPERIAL_COLOR]: 5 }
        citizen.supply = 7

        expectWarbandsConserved(state, () => {
            new HydratedCampaign(
                buildAction(Campaign, {
                    playerId: CITIZEN,
                    defender: { kind: 'player', playerId: DEFENDER },
                    targets: [siteTarget('c1')],
                    attackDice: 5,
                })
            ).apply(state)
        })

        const skulls = state.campaign?.attackRoll.reduce((n, f) => n + f.skulls, 0) ?? 0
        expect(skulls).toBeGreaterThan(0)
        expect(state.getPlayerState(CHANCELLOR).warbandsInPersonalBank[IMPERIAL_COLOR]).toBe(
            15 + skulls
        )
    })
})

describe('the campaign held on state', () => {
    it('records the battle for the actions that finish it', () => {
        const state = table()
        campaign().apply(state)

        expect(state.campaign).toMatchObject({
            attackerPlayerId: ATTACKER,
            defenderPlayerId: DEFENDER,
            allyPlayerIds: [],
            attackPool: 3
        })
        expect(state.campaign?.attackerVictorious).toBeUndefined()
    })

    it('refuses to start one while another is in flight (R-4.2)', () => {
        const state = table()
        campaign().apply(state)
        expect(() => campaign().apply(state)).toThrow(/already under way/)
    })

    it('conserves favor -- step 1 touches none of it', () => {
        const state = table()
        expectFavorConserved(state, () => campaign().apply(state))
    })
})

describe('legality (canDoCampaign)', () => {
    it('is offered when a defender and a legal target exist', () => {
        expect(HydratedCampaign.canDoCampaign(table(), ATTACKER)).toBe(true)
    })

    it('is not offered without the Supply', () => {
        const state = table()
        state.getPlayerState(ATTACKER).supply = 1
        expect(HydratedCampaign.canDoCampaign(state, ATTACKER)).toBe(false)
    })

    it('treats a pawn off the map as a broken invariant, not a refusal (R-1.23.1)', () => {
        const state = table()
        state.getPlayerState(ATTACKER).siteId = undefined
        expect(() => HydratedCampaign.canDoCampaign(state, ATTACKER)).toThrow(`${ATTACKER}'s pawn must be at a site`)
    })

    it('is not offered mid-Campaign', () => {
        const state = table()
        campaign().apply(state)
        expect(HydratedCampaign.canDoCampaign(state, ATTACKER)).toBe(false)
    })

    it('lists the defenders that can be chosen (R-5.5.1)', () => {
        expect(HydratedCampaign.legalDefenders(table(), ATTACKER)).toEqual([{ kind: 'player', playerId: DEFENDER }])
    })

    it('lists the bandits when no player rules your site', () => {
        const state = table()
        state.getPlayerState(ATTACKER).siteId = 'h3'
        expect(HydratedCampaign.legalDefenders(state, ATTACKER)).toEqual([{ kind: 'bandits' }])
    })
})

describe('the machine', () => {
    it('holds in CampaignSacrifice until the attacker decides (R-5.5.5)', () => {
        const state = table({ machineState: MachineState.CampaignSacrifice })
        campaign().apply(state)
        const handler = new CampaignSacrificeStateHandler()
        const context = machineContext(state)
        handler.enter(context)

        expect(state.activePlayerIds).toEqual([ATTACKER])
        expect(handler.validActionsForPlayer(ATTACKER, context)).toEqual([ActionType.CampaignSacrifice])
        expect(handler.validActionsForPlayer(DEFENDER, context)).toEqual([])
    })
})

/** Searches for a seed rather than mocking dice, so the roll runs the real `apply()` path. */
function seedRollingSkulls(atLeast: number): number {
    for (let seed = 1; seed < 5000; seed++) {
        const state = table({ prng: { seed, invocations: 0 } })
        const probe = new HydratedCampaign(
            buildAction(Campaign, {
                playerId: ATTACKER,
                defender: { kind: 'player', playerId: DEFENDER },
                targets: [siteTarget('c1')],
                attackDice: 5,
            })
        )
        probe.apply(state)
        const skulls = state.campaign?.attackRoll.reduce((n, f) => n + f.skulls, 0) ?? 0
        if (skulls >= atLeast) return seed
    }
    throw Error('no seed found rolling a skull')
}
