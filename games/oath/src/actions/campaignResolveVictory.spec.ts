import { describe, expect, it } from 'vitest'
import { Color, getPrng } from '@tabletop/common'
import { Banner, PlayerStatus } from '../model/oathEnums.js'
import { campaignRecords, testPlayer, testState } from '../testing/fixture.js'
import { expectOneWarbandOwnerPerSite, expectWarbandsConserved } from '../testing/census.js'
import { expectFavorConserved } from '../testing/census.js'
import { CampaignTargetKind, type CampaignState, type CampaignTarget } from '../model/campaign.js'
import { HydratedCampaignResolveVictory, CampaignResolveVictory } from './campaignResolveVictory.js'
import { createOathVault } from '../model/vault.js'
import { buildAction } from '../testing/actions.js'
import { siteTarget } from '../testing/choices.js'
import { PowerQuestionKind } from '../model/question.js'
import '../powers/index.js'
import { IMPERIAL_WARBANDS } from '../model/warbandCounts.js'

const CHANCELLOR = 'chancellor'
const ATTACKER = 'attacker'
const DEFENDER = 'defender'

const pawnAndFavor: CampaignTarget = { kind: CampaignTargetKind.PawnAndFavor }

/** R-5.5.6 has already cleared the targeted sites. */
function won(campaign: Partial<CampaignState> = {}, stateOverrides: Record<string, unknown> = {}) {
    return testState(
        [
            testPlayer({
                playerId: ATTACKER,
                color: Color.Red,
                status: PlayerStatus.Exile,
                siteId: 'c1',
                warbandsOnBoard: { [ATTACKER]: 4 },
                warbandsInPersonalBank: { [ATTACKER]: 8 },
                relicIds: []
            }),
            testPlayer({
                playerId: DEFENDER,
                color: Color.Yellow,
                status: PlayerStatus.Exile,
                siteId: 'c1',
                favor: 7,
                warbandsOnBoard: { [DEFENDER]: 3 },
                warbandsInPersonalBank: { [DEFENDER]: 11 },
                relicIds: ['relic.crown', 'relic.cup']
            }),
            testPlayer({
                playerId: CHANCELLOR,
                color: Color.Purple,
                status: PlayerStatus.Chancellor,
                siteId: 'h1',
                warbandsOnBoard: { [IMPERIAL_WARBANDS]: 6 },
                warbandsInPersonalBank: { [IMPERIAL_WARBANDS]: 18 }
            })
        ],
        {
            chancellorPlayerId: CHANCELLOR,
            warbandsBySite: { c1: {}, p1: {} },
            favorSupply: 10,
            campaign: {
                attackerPlayerId: ATTACKER,
                defenderPlayerId: DEFENDER,
                nonImperialPlayerIds: [],
                allyPlayerIds: [],
                targets: [siteTarget('c1')],
                attackPool: 4,
                defensePool: 1,
                attackRoll: [],
                defenseRoll: [],
                defense: 2,
                swords: 5,
                defendingForce: [],
                defendingBandits: 0,
                ...campaignRecords(),
                attackerVictorious: true,
                ...campaign
            },
            ...stateOverrides
        }
    )
}

function resolve(fields: Record<string, unknown> = {}) {
    return new HydratedCampaignResolveVictory(
        buildAction(CampaignResolveVictory, {
            playerId: ATTACKER,
            placements: [],
            burnFavor: false,
            ...fields
        })
    )
}

describe('taking rule of targeted sites (R-5.5.7.I)', () => {
    it('places warbands from the force onto a targeted site', () => {
        const state = won()
        expectWarbandsConserved(state, () =>
            resolve({
                placements: [{ siteId: 'c1', owner: ATTACKER, count: 2 }]
            }).apply(state)
        )

        expect(state.warbandsBySite['c1'][ATTACKER]).toBe(2)
        expect(state.getPlayerState(ATTACKER).warbandsOnBoard[ATTACKER]).toBe(2)
    })

    it('allows placing zero, which is explicit in the rule', () => {
        const state = won()
        expect(() => resolve({ placements: [] }).apply(state)).not.toThrow()
        expect(state.getPlayerState(ATTACKER).warbandsOnBoard[ATTACKER]).toBe(4)
    })

    it('refuses a site that was not targeted', () => {
        const state = won()
        expect(() =>
            resolve({ placements: [{ siteId: 'p1', owner: ATTACKER, count: 1 }] }).apply(state)
        ).toThrow(/p1 was not targeted/)
    })

    it('refuses to place more warbands than the force holds', () => {
        const state = won()
        expect(() =>
            resolve({ placements: [{ siteId: 'c1', owner: ATTACKER, count: 5 }] }).apply(state)
        ).toThrow(/only 4/)
    })

    it('refuses a negative placement', () => {
        const valid = buildAction(CampaignResolveVictory, {
            playerId: ATTACKER,
            placements: [{ siteId: 'c1', owner: ATTACKER, count: 1 }],
            burnFavor: false
        })
        expect(
            () =>
                new HydratedCampaignResolveVictory({
                    ...valid,
                    placements: [{ siteId: 'c1', owner: ATTACKER, count: -1 }]
                })
        ).toThrow(/at least 0|must be >= 0/)
    })

    it('leaves no site holding two players\' warbands', () => {
        const state = won()
        resolve({ placements: [{ siteId: 'c1', owner: ATTACKER, count: 3 }] }).apply(state)
        expectOneWarbandOwnerPerSite(state)
    })

    it('spreads a placement across several targeted sites', () => {
        const state = won({ targets: [siteTarget('c1'), siteTarget('p1')] })
        expectWarbandsConserved(state, () =>
            resolve({
                placements: [
                    { siteId: 'c1', owner: ATTACKER, count: 1 },
                    { siteId: 'p1', owner: ATTACKER, count: 2 }
                ]
            }).apply(state)
        )
        expect(state.warbandsBySite['p1'][ATTACKER]).toBe(2)
        expect(state.getPlayerState(ATTACKER).warbandsOnBoard[ATTACKER]).toBe(1)
    })

    it('sums repeated placements on one site before checking the force', () => {
        const state = won()
        expect(() =>
            resolve({
                placements: [
                    { siteId: 'c1', owner: ATTACKER, count: 3 },
                    { siteId: 'c1', owner: ATTACKER, count: 3 }
                ]
            }).apply(state)
        ).toThrow(/only 4/)
    })
})

describe('taking targeted relics and banners (R-5.5.7.II)', () => {
    it('takes every targeted relic, without being asked', () => {
        const state = won({
            targets: [siteTarget('c1'), { kind: CampaignTargetKind.Relic, cardId: 'relic.crown' }]
        })
        resolve().apply(state)

        expect(state.getPlayerState(ATTACKER).relicIds).toEqual(['relic.crown'])
        expect(state.getPlayerState(DEFENDER).relicIds).toEqual(['relic.cup'])
    })

    it('seizes a targeted banner, burning two and flipping the Mob side', () => {
        const state = won({
            targets: [siteTarget('c1'), { kind: CampaignTargetKind.Banner, banner: Banner.PeoplesFavor }]
        })
        state.banners[Banner.PeoplesFavor] = { holderPlayerId: DEFENDER, value: 5, mobSide: false }

        expectFavorConserved(state, () => resolve().apply(state))

        const banner = state.banners[Banner.PeoplesFavor]
        expect(banner.holderPlayerId).toBe(ATTACKER)
        expect(banner.value).toBe(3)
        expect(banner.mobSide).toBe(true)
        // R-10.4 — burned favor goes to the shared bank, not a suit bank.
        expect(state.favorSupply).toBe(12)
    })

    it('never takes a banner below one favor (R-2.5.3)', () => {
        const state = won({
            targets: [siteTarget('c1'), { kind: CampaignTargetKind.Banner, banner: Banner.PeoplesFavor }]
        })
        state.banners[Banner.PeoplesFavor] = { holderPlayerId: DEFENDER, value: 2, mobSide: false }

        expectFavorConserved(state, () => resolve().apply(state))
        expect(state.banners[Banner.PeoplesFavor].value).toBe(1)
    })

    it('burns secrets, not favor, from the Darkest Secret', () => {
        const state = won({
            targets: [siteTarget('c1'), { kind: CampaignTargetKind.Banner, banner: Banner.DarkestSecret }]
        })
        state.banners[Banner.DarkestSecret] = { holderPlayerId: DEFENDER, value: 4 }

        resolve().apply(state)
        expect(state.banners[Banner.DarkestSecret].value).toBe(2)
        // R-9.3 — secrets are not component-limited, so nothing returns to a pool.
        expect(state.favorSupply).toBe(10)
    })
})

describe('banishing the pawn and burning favor (R-5.5.7.III)', () => {
    it('moves the pawn to the chosen site, spending no Supply', () => {
        const state = won({ targets: [siteTarget('c1'), pawnAndFavor] })
        const supplyBefore = state.getPlayerState(DEFENDER).supply

        resolve({ banishToSiteId: 'p1' }).apply(state)

        expect(state.getPlayerState(DEFENDER).siteId).toBe('p1')
        expect(state.getPlayerState(DEFENDER).supply).toBe(supplyBefore)
    })

    it('burns half the favor, rounded down, to the shared bank (R-10.4)', () => {
        const state = won({ targets: [siteTarget('c1'), pawnAndFavor] })
        expect(HydratedCampaignResolveVictory.favorToBurn(state)).toBe(3)
        expectFavorConserved(state, () => resolve({ burnFavor: true }).apply(state))

        expect(state.getPlayerState(DEFENDER).favor).toBe(4)
        expect(state.favorSupply).toBe(13)
    })

    it('is optional in both halves -- the rule says "may" twice', () => {
        const state = won({ targets: [siteTarget('c1'), pawnAndFavor] })
        resolve().apply(state)

        expect(state.getPlayerState(DEFENDER).siteId).toBe('c1')
        expect(state.getPlayerState(DEFENDER).favor).toBe(7)
    })

    it('refuses to banish when the pawn was not targeted', () => {
        const state = won()
        expect(() => resolve({ banishToSiteId: 'p1' }).apply(state)).toThrow(
            /did not target their pawn/
        )
    })

    it('refuses to burn favor when the pawn was not targeted', () => {
        const state = won()
        expect(() => resolve({ burnFavor: true }).apply(state)).toThrow(
            /did not target their pawn/
        )
    })

    it('refuses a destination that is not on the map', () => {
        const state = won({ targets: [siteTarget('c1'), pawnAndFavor] })
        expect(() => resolve({ banishToSiteId: 'nowhere' }).apply(state)).toThrow(
            /not a site on the map/
        )
    })

    it('refuses to banish a pawn to the site it already occupies', () => {
        const state = won({ targets: [siteTarget('c1'), pawnAndFavor] })
        expect(() => resolve({ banishToSiteId: 'c1' }).apply(state)).toThrow(
            /already occupies/
        )
    })

    it('"a site they are able to travel to": the Narrow Pass binds the banished pawn too', () => {
        const state = won({ targets: [siteTarget('c1'), pawnAndFavor] }, { siteCards: { c1: 'site.plains', p1: 'site.narrow-pass', p2: 'site.river' } })
        expect(HydratedCampaignResolveVictory.reasonCannotResolveVictory(state, ATTACKER, { placements: [], burnFavor: false, banishToSiteId: 'p2' })).toMatch(/must travel to p1/)
        expect(HydratedCampaignResolveVictory.reasonCannotResolveVictory(state, ATTACKER, { placements: [], burnFavor: false, banishToSiteId: 'p1' })).toBeUndefined()
    })

    it('"a site they are able to travel to": Vow of Union keeps the pawn at a site its holder rules', () => {
        const state = won({ targets: [pawnAndFavor] }, { siteCards: { c1: 'site.plains', p1: 'site.river' }, warbandsBySite: { c1: { [DEFENDER]: 1 }, p1: {} } })
        state.getPlayerState(DEFENDER).setAdvisers([{ cardId: 'denizen.beast.vow-of-union', faceUp: true }])
        expect(HydratedCampaignResolveVictory.reasonCannotResolveVictory(state, ATTACKER, { placements: [], burnFavor: false, banishToSiteId: 'p1' })).toMatch(/Vow of Union/)
    })

    it('a banish is travel: the after-travel powers fire at the destination (Boiling Lake)', () => {
        const state = won({ targets: [siteTarget('c1'), pawnAndFavor] }, { denizensBySite: { c1: [], p1: ['denizen.discord.boiling-lake'] } })
        const action = resolve({ banishToSiteId: 'p1' })
        action.apply(state)
        expect(state.getPlayerState(DEFENDER).warbandsOnBoard[DEFENDER]).toBe(1)
        expect(action.metadata?.triggered).toContainEqual(expect.stringMatching(/Boiling Lake/))
    })

    it('R-11.7 — from a Shrouded Wood an enemy rules, that ruler chooses where the pawn goes', () => {
        const state = won({ targets: [siteTarget('c1'), pawnAndFavor] }, { siteCards: { c1: 'site.shrouded-wood', p1: 'site.river' }, warbandsBySite: { c1: { [ATTACKER]: 1 }, p1: {} } })
        expect(HydratedCampaignResolveVictory.reasonCannotResolveVictory(state, ATTACKER, { placements: [], burnFavor: false, banishToSiteId: 'p1' })).toMatch(/Shrouded Wood's ruler chooses/)
        resolve({ banish: true }).apply(state)
        expect(state.pendingQuestions?.queue[0]).toMatchObject({ kind: PowerQuestionKind.ShroudedWoodDestination, askedPlayerId: ATTACKER, travelerPlayerId: DEFENDER, fromSiteId: 'c1' })
    })
})

describe('finishing', () => {
    it('clears the campaign, ending it (R-5.5.8)', () => {
        const state = won()
        resolve().apply(state)
        expect(state.campaign).toBeUndefined()
    })

    it('refuses when no Campaign is under way', () => {
        const state = won()
        state.campaign = undefined
        expect(() => resolve().apply(state)).toThrow(/no Campaign/)
    })

    it('refuses when the attacker was defeated -- there is no step 7', () => {
        const state = won({ attackerVictorious: false })
        expect(() => resolve().apply(state)).toThrow(/was not victorious/)
    })

    it('refuses before the sacrifice has resolved the battle', () => {
        const state = won({ attackerVictorious: undefined })
        expect(() => resolve().apply(state)).toThrow(/not been resolved/)
    })

    it('refuses a player who is not the attacker', () => {
        const state = won()
        expect(() => resolve({ playerId: DEFENDER }).apply(state)).toThrow(/only the attacker/)
    })
})

describe('a bandit victory', () => {
    it('takes no relics, banners or pawn from bandits that have none', () => {
        const state = won({
            defenderPlayerId: undefined,
            targets: [siteTarget('p1')],
            defendingBandits: 1
        })
        expectWarbandsConserved(state, () =>
            resolve({ placements: [{ siteId: 'p1', owner: ATTACKER, count: 2 }] }).apply(state)
        )

        expect(state.warbandsBySite['p1'][ATTACKER]).toBe(2)
        expect(state.getPlayerState(ATTACKER).relicIds).toEqual([])
    })
})

describe('R-5.5.7.III — banish to a facedown site never resolves the reveal', () => {
    const pawnAndFavor: CampaignTarget = { kind: CampaignTargetKind.PawnAndFavor }

    function wonBoard() {
        const faceupSlots = ['c1', 'c2', 'p1', 'p2', 'p3', 'h1', 'h2']
        return testState(
            [
                testPlayer({
                    playerId: 'attacker',
                    color: Color.Red,
                    siteId: 'c1',
                    warbandsOnBoard: { [ATTACKER]: 4 },
                    warbandsInPersonalBank: { [ATTACKER]: 8 }
                }),
                testPlayer({
                    playerId: 'defender',
                    color: Color.Yellow,
                    siteId: 'c1',
                    favor: 6,
                    warbandsInPersonalBank: { [DEFENDER]: 11 }
                })
            ],
            {
                siteCards: Object.fromEntries(faceupSlots.map((s) => [s, s])),
                warbandsBySite: { c1: {} },
                favorSupply: 10,
                campaign: {
                    attackerPlayerId: 'attacker',
                    defenderPlayerId: 'defender',
                    nonImperialPlayerIds: [],
                    allyPlayerIds: [],
                    targets: [siteTarget('c1'), pawnAndFavor],
                    attackPool: 4,
                    defensePool: 1,
                    attackRoll: [],
                    defenseRoll: [],
                    defense: 2,
                    swords: 5,
                    defendingForce: [],
                    defendingBandits: 0,
                    ...campaignRecords(),
                    attackerVictorious: true
                }
            }
        )
    }

    function banishTo(siteId: string) {
        return new HydratedCampaignResolveVictory(
            buildAction(CampaignResolveVictory, {
                playerId: 'attacker',
                placements: [],
                burnFavor: false,
                banishToSiteId: siteId
            })
        )
    }

    it('through the resolver, a facedown destination is revealed (R-5.6.2)', () => {
        // R-11.7 — a player made to travel still reveals a facedown destination.
        const state = wonBoard()
        const vault = createOathVault({}, getPrng(5))
        vault.siteFacedown['h3'] = 'site.drowned-city'
        vault.relicDeck = ['relic.unnamed-1', 'relic.unnamed-2', 'relic.unnamed-3']

        const action = banishTo('h3')
        state.vault = vault
        action.apply(state)

        expect(state.getPlayerState('defender').siteId).toBe('h3')
        expect(state.isSiteFaceup('h3')).toBe(true)
        expect(state.siteCardAt('h3')).toBe('site.drowned-city')
        expect(state.relicsBySite['h3']).toHaveLength(2)
        expect(state.tokensOn('site.drowned-city').secrets).toBe(3)
        expect(vault.siteFacedown['h3']).toBeUndefined()
        expect(action.revealsInfo).toBe(true)
        expect(action.metadata?.revealedSiteCardId).toBe('site.drowned-city')
    })
})
