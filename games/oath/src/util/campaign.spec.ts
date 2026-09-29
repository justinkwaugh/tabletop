import { beforeAll, describe, expect, it } from 'vitest'
import { Color } from '@tabletop/common'
import { Banner, CardKind, IMPERIAL_COLOR, PlayerStatus } from '../model/oathEnums.js'
import { registerCards } from '../data/cardRegistry.js'
import { CampaignTargetKind, type CampaignTarget } from '../model/campaign.js'
import { testPlayer, testState } from '../testing/fixture.js'
import { expectOneWarbandColorPerSite, multiColorSites } from '../testing/census.js'
import {
    applyDiceDelta,
    collectDefendingBandits,
    collectDefendingForce,
    collectDefensePool,
    reasonCannotDeclareTargets,
    titleDefenseDice,
    type CampaignParties
} from './campaign.js'
import { siteTarget } from '../testing/choices.js'

const CHANCELLOR = 'chancellor'
const CITIZEN = 'citizen'
const ATTACKER = 'attacker'
const DEFENDER = 'defender'

beforeAll(() => {
    registerCards([
        { id: 'relic.crown', name: 'Crown', kind: CardKind.Relic, defenseDice: 2 },
        { id: 'relic.cup', name: 'Cup', kind: CardKind.Relic, defenseDice: 1 },
        { id: 'relic.unknown.noShield', name: 'No shield', kind: CardKind.Relic }
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
                warbandsOnBoard: { [Color.Red]: 5 },
                warbandsInPersonalBank: { [Color.Red]: 9 }
            }),
            testPlayer({
                playerId: DEFENDER,
                color: Color.Yellow,
                status: PlayerStatus.Exile,
                siteId: 'p1',
                favor: 6,
                warbandsOnBoard: { [Color.Yellow]: 4 },
                warbandsInPersonalBank: { [Color.Yellow]: 10 }
            }),
            testPlayer({
                playerId: CHANCELLOR,
                color: Color.Purple,
                status: PlayerStatus.Chancellor,
                siteId: 'h1',
                warbandsOnBoard: { [IMPERIAL_COLOR]: 6 },
                warbandsInPersonalBank: { [IMPERIAL_COLOR]: 18 }
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
            warbandsBySite: {
                c1: { [Color.Yellow]: 1 },
                p1: { [Color.Yellow]: 3 },
                p2: { [Color.Yellow]: 2 }
            },
            ...overrides
        }
    )
}

function parties(targets: CampaignTarget[], overrides: Partial<CampaignParties> = {}): CampaignParties {
    return {
        attackerPlayerId: ATTACKER,
        defenderPlayerId: DEFENDER,
        allyPlayerIds: [],
        nonImperialPlayerIds: [],
        targets,
        ...overrides
    }
}

const relic = (cardId: string): CampaignTarget => ({ kind: CampaignTargetKind.Relic, cardId })
const banner = (b: Banner): CampaignTarget => ({ kind: CampaignTargetKind.Banner, banner: b })
const pawnAndFavor: CampaignTarget = { kind: CampaignTargetKind.PawnAndFavor }

describe('collecting the defense pool (R-5.5.2)', () => {
    it('adds one die per targeted site, flat (R-2.8.3)', () => {
        expect(collectDefensePool(table(), parties([siteTarget('c1')]))).toBe(1)
        expect(collectDefensePool(table(), parties([siteTarget('c1'), siteTarget('p1')]))).toBe(2)
    })

    it("adds the dice printed on a targeted relic's shield (R-2.4.2)", () => {
        const state = table()
        state.getPlayerState(DEFENDER).siteId = 'c1'
        state.getPlayerState(DEFENDER).relicIds = ['relic.crown', 'relic.cup']

        expect(collectDefensePool(state, parties([relic('relic.crown')]))).toBe(2)
        expect(
            collectDefensePool(state, parties([relic('relic.crown'), relic('relic.cup')]))
        ).toBe(3)
    })

    it('refuses a relic whose shield is not recorded, rather than counting zero', () => {
        const state = table()
        state.getPlayerState(DEFENDER).siteId = 'c1'
        state.getPlayerState(DEFENDER).relicIds = ['relic.unknown.noShield']

        expect(() =>
            collectDefensePool(state, parties([relic('relic.unknown.noShield')]))
        ).toThrow(/no recorded defense dice/)
    })

    it('adds a banner\'s dice equal to what is stacked on it (R-2.5.2)', () => {
        const state = table()
        state.getPlayerState(DEFENDER).siteId = 'c1'
        state.banners[Banner.PeoplesFavor] = { holderPlayerId: DEFENDER, value: 4 }

        expect(collectDefensePool(state, parties([banner(Banner.PeoplesFavor)]))).toBe(4)
    })

    it('adds two dice for the pawn-and-favor target (R-5.5.2)', () => {
        const state = table()
        state.getPlayerState(DEFENDER).siteId = 'c1'
        expect(collectDefensePool(state, parties([pawnAndFavor]))).toBe(2)
    })

    it('sums every target together', () => {
        const state = table()
        state.getPlayerState(DEFENDER).siteId = 'c1'
        state.getPlayerState(DEFENDER).relicIds = ['relic.crown']
        state.banners[Banner.DarkestSecret] = { holderPlayerId: DEFENDER, value: 3 }

        const pool = collectDefensePool(
            state,
            parties([siteTarget('p1'), relic('relic.crown'), banner(Banner.DarkestSecret), pawnAndFavor])
        )
        expect(pool).toBe(1 + 2 + 3 + 2)
    })
})

describe('the Oathkeeper title as a defender (R-2.11.c, R-2.11.d)', () => {
    it('adds one die when the defender holds it on its Oathkeeper side', () => {
        const state = table({ oathkeeperPlayerId: DEFENDER })
        expect(titleDefenseDice(state, parties([siteTarget('p1')]))).toBe(1)
    })

    it('adds two when it is on its Usurper side (R-2.11.c)', () => {
        const state = table({ oathkeeperPlayerId: DEFENDER, oathkeeperIsUsurper: true })
        expect(titleDefenseDice(state, parties([siteTarget('p1')]))).toBe(2)
    })

    it('adds nothing when someone other than the defender holds it', () => {
        const state = table({ oathkeeperPlayerId: ATTACKER })
        expect(titleDefenseDice(state, parties([siteTarget('p1')]))).toBe(0)
    })

    it('adds nothing when nobody holds it', () => {
        expect(titleDefenseDice(table(), parties([siteTarget('p1')]))).toBe(0)
    })

    it("lends the Chancellor's title to a defending Citizen (R-2.11.d)", () => {
        const state = table({ oathkeeperPlayerId: CHANCELLOR })
        expect(
            titleDefenseDice(state, parties([siteTarget('p1')], { defenderPlayerId: CITIZEN }))
        ).toBe(1)
    })

    // R-5.5.1.a — the Chancellor attacking a Citizen suspends that Citizen's Imperial status.
    it('withholds it from a Citizen whose Imperial status this Campaign suspends', () => {
        const state = table({ oathkeeperPlayerId: CHANCELLOR })
        expect(
            titleDefenseDice(
                state,
                parties([siteTarget('p1')], {
                    attackerPlayerId: CHANCELLOR,
                    defenderPlayerId: CITIZEN,
                    nonImperialPlayerIds: [CITIZEN]
                })
            )
        ).toBe(0)
    })

    it('does not lend a Citizen-held title to the Chancellor (R-2.11.c is the rule)', () => {
        // R-2.11.d covers only the Chancellor's title; R-9.1 lets R-2.11.c govern.
        const state = table({ oathkeeperPlayerId: CITIZEN })
        expect(
            titleDefenseDice(state, parties([siteTarget('p1')], { defenderPlayerId: CHANCELLOR }))
        ).toBe(0)
    })

    it('adds nothing when the bandits are defending', () => {
        const state = table({ oathkeeperPlayerId: CHANCELLOR })
        expect(
            titleDefenseDice(state, parties([siteTarget('p1')], { defenderPlayerId: undefined }))
        ).toBe(0)
    })
})

describe('collecting the defending force (R-5.5.4, R-10.9)', () => {
    it("counts the defender's warbands at every targeted site", () => {
        const force = collectDefendingForce(table(), parties([siteTarget('p1'), siteTarget('p2')]))
        expect(force.filter((g) => g.at.kind === 'site')).toEqual([
            { at: { kind: 'site', siteId: 'p1' }, color: Color.Yellow, count: 3 },
            { at: { kind: 'site', siteId: 'p2' }, color: Color.Yellow, count: 2 }
        ])
    })

    it("counts only the defender's warbands, on a board that could not occur", () => {
        const state = table({
            warbandsBySite: { c1: { [Color.Red]: 2, [Color.Yellow]: 1 } }
        })
        expect(multiColorSites(state)).toHaveLength(1)

        const force = collectDefendingForce(state, parties([siteTarget('c1')]))
        expect(force).toEqual([
            { at: { kind: 'site', siteId: 'c1' }, color: Color.Yellow, count: 1 }
        ])
    })

    it('holds the one-player-per-site invariant on its own fixtures', () => {
        expectOneWarbandColorPerSite(table())
    })

    it('counts no warbands at a site nobody targeted', () => {
        const force = collectDefendingForce(table(), parties([siteTarget('p1')]))
        expect(force.some((g) => g.at.kind === 'site' && g.at.siteId === 'p2')).toBe(false)
    })

    it("adds the defender's board warbands when their pawn is at the attacker's site", () => {
        const state = table()
        state.getPlayerState(DEFENDER).siteId = 'c1'

        const force = collectDefendingForce(state, parties([siteTarget('p1')]))
        expect(force).toContainEqual({
            at: { kind: 'board', playerId: DEFENDER },
            color: Color.Yellow,
            count: 4
        })
    })

    it("adds the defender's board warbands when their pawn is at a targeted site", () => {
        const force = collectDefendingForce(table(), parties([siteTarget('p1')]))
        expect(force).toContainEqual({
            at: { kind: 'board', playerId: DEFENDER },
            color: Color.Yellow,
            count: 4
        })
    })

    it('leaves the board out when the pawn is at neither (R-5.5.4)', () => {
        const state = table()
        state.getPlayerState(DEFENDER).siteId = 'h3'

        const force = collectDefendingForce(state, parties([siteTarget('p1')]))
        expect(force.every((g) => g.at.kind === 'site')).toBe(true)
    })

    it("adds an Ally's board warbands on the same condition (R-5.5.4.b)", () => {
        const state = table()
        state.getPlayerState(CITIZEN).siteId = 'c1'

        const force = collectDefendingForce(
            state,
            parties([siteTarget('p1')], { allyPlayerIds: [CITIZEN] })
        )
        expect(force).toContainEqual({
            at: { kind: 'board', playerId: CITIZEN },
            color: IMPERIAL_COLOR,
            count: 3
        })
    })

    it("leaves an Ally's board out when their pawn is nowhere relevant (R-5.5.4.b)", () => {
        const force = collectDefendingForce(
            table(),
            parties([siteTarget('p1')], { allyPlayerIds: [CHANCELLOR] })
        )
        expect(force.some((g) => g.at.kind === 'board' && g.at.playerId === CHANCELLOR)).toBe(
            false
        )
    })

    it('counts an Imperial defence through purple, not the Citizen colour', () => {
        const state = table({
            warbandsBySite: { c1: { [Color.Red]: 2 }, p1: { [IMPERIAL_COLOR]: 4 } }
        })
        const force = collectDefendingForce(
            state,
            parties([siteTarget('p1')], { defenderPlayerId: CITIZEN })
        )
        expect(force).toContainEqual({
            at: { kind: 'site', siteId: 'p1' },
            color: IMPERIAL_COLOR,
            count: 4
        })
    })

    it('is empty when the bandits are defending -- bandits are not warbands (R-10.3)', () => {
        const force = collectDefendingForce(
            table(),
            parties([siteTarget('h3')], { defenderPlayerId: undefined })
        )
        expect(force).toEqual([])
    })
})

describe('bandits in the defending force (R-2.8.3)', () => {
    it('adds one bandit per targeted site when attacking the bandits', () => {
        const p = parties([siteTarget('h1'), siteTarget('h2')], { defenderPlayerId: undefined })
        expect(collectDefendingBandits(table(), p)).toBe(2)
    })

    it('adds none when a player is defending', () => {
        expect(collectDefendingBandits(table(), parties([siteTarget('p1')]))).toBe(0)
    })
})

describe('battle plan pool arithmetic (R-5.5.3)', () => {
    it('adds and removes dice from each pool', () => {
        expect(applyDiceDelta({ attackPool: 4, defensePool: 3 }, { attack: 2 })).toEqual({
            attackPool: 6,
            defensePool: 3
        })
        expect(applyDiceDelta({ attackPool: 4, defensePool: 3 }, { defense: -1 })).toEqual({
            attackPool: 4,
            defensePool: 2
        })
    })

    it('turns an attack die the pool cannot pay into a defense die', () => {
        expect(applyDiceDelta({ attackPool: 0, defensePool: 3 }, { attack: -1 })).toEqual({
            attackPool: 0,
            defensePool: 4
        })
    })

    it('converts only the dice that underflow, not the whole loss', () => {
        expect(applyDiceDelta({ attackPool: 1, defensePool: 3 }, { attack: -2 })).toEqual({
            attackPool: 0,
            defensePool: 4
        })
    })

    it('never drives the defense pool below zero', () => {
        expect(applyDiceDelta({ attackPool: 4, defensePool: 1 }, { defense: -3 })).toEqual({
            attackPool: 4,
            defensePool: 0
        })
    })
})

describe('declaring targets (R-5.5.2)', () => {
    it('accepts a site the defender rules', () => {
        expect(reasonCannotDeclareTargets(table(), parties([siteTarget('c1')]))).toBeUndefined()
    })

    it('rejects a site the defender does not rule', () => {
        expect(reasonCannotDeclareTargets(table(), parties([siteTarget('c1'), siteTarget('h3')]))).toMatch(
            /h3/
        )
    })

    it('requires at least one target at the attacker\'s site (R-5.5.2)', () => {
        expect(reasonCannotDeclareTargets(table(), parties([siteTarget('p1')]))).toMatch(
            /at least one target at your site/
        )
    })

    it('requires no targets at all when there are none to declare', () => {
        expect(reasonCannotDeclareTargets(table(), parties([]))).toMatch(/at least one target/)
    })

    it("forces targeting your own site when the defender rules it (R-5.5.2)", () => {
        const state = table()
        state.getPlayerState(DEFENDER).siteId = 'c1'
        state.getPlayerState(DEFENDER).relicIds = ['relic.cup']

        const reason = reasonCannotDeclareTargets(state, parties([relic('relic.cup')]))
        expect(reason).toMatch(/must target your site/)
    })

    it('rejects a relic the defender does not hold', () => {
        const state = table()
        state.getPlayerState(DEFENDER).siteId = 'c1'
        expect(reasonCannotDeclareTargets(state, parties([relic('relic.crown')]))).toMatch(
            /does not hold/
        )
    })

    it("rejects a relic when the defender's pawn is elsewhere (R-5.5.2)", () => {
        const state = table()
        state.getPlayerState(DEFENDER).relicIds = ['relic.crown']
        expect(
            reasonCannotDeclareTargets(state, parties([siteTarget('c1'), relic('relic.crown')]))
        ).toMatch(/pawn is not at your site/)
    })

    it("rejects a banner the defender does not hold", () => {
        const state = table()
        state.getPlayerState(DEFENDER).siteId = 'c1'
        expect(
            reasonCannotDeclareTargets(state, parties([banner(Banner.PeoplesFavor)]))
        ).toMatch(/does not hold/)
    })

    it("rejects pawn-and-favor when the pawn is elsewhere", () => {
        expect(
            reasonCannotDeclareTargets(table(), parties([siteTarget('c1'), pawnAndFavor]))
        ).toMatch(/pawn is not at your site/)
    })

    it('rejects the same target declared twice', () => {
        expect(
            reasonCannotDeclareTargets(table(), parties([siteTarget('c1'), siteTarget('c1')]))
        ).toMatch(/declared twice/)
    })

    it('accepts targeting the bandits at your site', () => {
        const state = table({ warbandsBySite: { c1: { [Color.Yellow]: 1 }, h3: {} } })
        state.getPlayerState(ATTACKER).siteId = 'h3'
        expect(
            reasonCannotDeclareTargets(
                state,
                parties([siteTarget('h3')], { defenderPlayerId: undefined })
            )
        ).toBeUndefined()
    })

    it('rejects a bandit Campaign targeting a site the bandits do not rule', () => {
        const state = table()
        state.getPlayerState(ATTACKER).siteId = 'h3'
        expect(
            reasonCannotDeclareTargets(
                state,
                parties([siteTarget('h3'), siteTarget('p1')], { defenderPlayerId: undefined })
            )
        ).toMatch(/p1/)
    })
})
