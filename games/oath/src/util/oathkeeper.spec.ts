import { describe, expect, it } from 'vitest'
import { Color } from '@tabletop/common'
import { Banner, IMPERIAL_COLOR, OathType, PlayerStatus } from '../model/oathEnums.js'
import { GRAND_SCEPTER_ID } from '../data/relics.js'
import { testBanners, testPlayer, testState } from '../testing/fixture.js'
import {
    Goal,
    OATHKEEPER_GOALS,
    VISION_GOALS,
    VISIONS_DRAWN_GATE,
    bannerHolder,
    citizensMeetingSuccessorGoal,
    meetsRevealedVisionGoal,
    meetsSuccessorGoal,
    playersMeetingGoal,
    playersMeetingOathkeeperGoal,
    relicsAndBannersHeld
} from './oathkeeper.js'
import type { OathGameState } from '../model/gameState.js'
import type { OathPlayerState } from '../model/playerState.js'

const CHANCELLOR = 'chancellor'
const CITIZEN = 'citizen'
const EXILE = 'exile'
const OTHER_EXILE = 'otherExile'

const CUP = 'relic.cup'
const CROWN = 'relic.crown'
const EYE = 'relic.ivory-eye'

function seats(overrides: Record<string, Partial<OathPlayerState>> = {}): OathPlayerState[] {
    return [
        testPlayer({
            playerId: CHANCELLOR,
            color: Color.Purple,
            status: PlayerStatus.Chancellor,
            warbandsInPersonalBank: { [IMPERIAL_COLOR]: 24 },
            ...overrides[CHANCELLOR]
        }),
        testPlayer({
            playerId: CITIZEN,
            color: Color.Blue,
            status: PlayerStatus.Citizen,
            // R-6.6.2 — a Citizen's warbands are purple, on board and on map.
            warbandsInPersonalBank: { [IMPERIAL_COLOR]: 0, [Color.Blue]: 14 },
            ...overrides[CITIZEN]
        }),
        testPlayer({
            playerId: EXILE,
            color: Color.Red,
            status: PlayerStatus.Exile,
            warbandsInPersonalBank: { [Color.Red]: 14 },
            ...overrides[EXILE]
        }),
        testPlayer({
            playerId: OTHER_EXILE,
            color: Color.Yellow,
            status: PlayerStatus.Exile,
            warbandsInPersonalBank: { [Color.Yellow]: 14 },
            ...overrides[OTHER_EXILE]
        })
    ]
}

function table(
    overrides: Partial<OathGameState> = {},
    playerOverrides: Record<string, Partial<OathPlayerState>> = {}
) {
    return testState(seats(playerOverrides), {
        chancellorPlayerId: CHANCELLOR,
        ...overrides
    })
}

describe('the goal mappings are keyed three different ways (R-2.10, R-2.11, R-3.2.a, R-3.3.1)', () => {
    it('keys the Oathkeeper goal to the sworn Oath (R-2.11)', () => {
        expect(OATHKEEPER_GOALS[OathType.Supremacy]).toBe(Goal.MostSites)
        expect(OATHKEEPER_GOALS[OathType.ThePeople]).toBe(Goal.PeoplesFavor)
        expect(OATHKEEPER_GOALS[OathType.Protection]).toBe(Goal.MostRelicsAndBanners)
        expect(OATHKEEPER_GOALS[OathType.Devotion]).toBe(Goal.DarkestSecret)
    })

    it('keys the Vision goal to the Vision, and gives the Conspiracy none (R-3.2.a, R-2.7.2)', () => {
        expect(VISION_GOALS['vision.conquest']).toBe(Goal.MostSites)
        expect(VISION_GOALS['vision.rebellion']).toBe(Goal.PeoplesFavor)
        expect(VISION_GOALS['vision.sanctuary']).toBe(Goal.MostRelicsAndBanners)
        expect(VISION_GOALS['vision.faith']).toBe(Goal.DarkestSecret)
        expect(VISION_GOALS['vision.conspiracy']).toBeUndefined()
    })
})

describe('the Oathkeeper goal (R-2.11)', () => {
    it('Supremacy goes to the player ruling the most sites (R-2.11, R-10.21)', () => {
        const state = table({
            oathType: OathType.Supremacy,
            warbandsBySite: {
                c1: { [Color.Red]: 1 },
                c2: { [Color.Red]: 1 },
                p1: { [Color.Yellow]: 3 }
            }
        })
        expect(playersMeetingOathkeeperGoal(state)).toEqual([EXILE])
    })

    it('lets ties qualify, because R-2.11.b exists to resolve them', () => {
        const state = table({
            oathType: OathType.Supremacy,
            warbandsBySite: { c1: { [Color.Red]: 1 }, c2: { [Color.Yellow]: 1 } }
        })
        expect(playersMeetingOathkeeperGoal(state)).toEqual([EXILE, OTHER_EXILE])
    })

    it('gives nobody the goal when no site is ruled at all (R-9.1 literal)', () => {
        const state = table({ oathType: OathType.Supremacy, warbandsBySite: {} })
        expect(playersMeetingOathkeeperGoal(state)).toEqual([])
    })

    it('The People goes to the banner holder, and to nobody while it is banked (R-2.11)', () => {
        const held = table({
            oathType: OathType.ThePeople,
            banners: testBanners({ [Banner.PeoplesFavor]: EXILE })
        })
        expect(playersMeetingOathkeeperGoal(held)).toEqual([EXILE])

        const banked = table({ oathType: OathType.ThePeople })
        expect(bannerHolder(banked, Banner.PeoplesFavor)).toBeUndefined()
        expect(playersMeetingOathkeeperGoal(banked)).toEqual([])
    })

    it('Devotion goes to the Darkest Secret holder (R-2.11)', () => {
        const state = table({
            oathType: OathType.Devotion,
            banners: testBanners({ [Banner.DarkestSecret]: CITIZEN })
        })
        expect(playersMeetingOathkeeperGoal(state)).toEqual([CITIZEN])
    })

    it('Protection counts relics and banners together (R-2.11)', () => {
        const state = table(
            {
                oathType: OathType.Protection,
                banners: testBanners({ [Banner.PeoplesFavor]: OTHER_EXILE })
            },
            { [EXILE]: { relicIds: [CUP, CROWN] }, [OTHER_EXILE]: { relicIds: [EYE] } }
        )
        expect(relicsAndBannersHeld(state, EXILE)).toBe(2)
        expect(relicsAndBannersHeld(state, OTHER_EXILE)).toBe(2)
        expect(playersMeetingOathkeeperGoal(state)).toEqual([EXILE, OTHER_EXILE])
    })
})

describe('R-2.11.d — the Empire holds Supremacy through the Chancellor', () => {
    it('drops Citizens from the qualifying set when the Empire meets the goal', () => {
        // R-6.6.3 — each Imperial player rules every purple site, so Chancellor and Citizen tie.
        const state = table({
            oathType: OathType.Supremacy,
            warbandsBySite: { c1: { [IMPERIAL_COLOR]: 2 }, c2: { [IMPERIAL_COLOR]: 1 } }
        })
        expect(playersMeetingGoal(state, Goal.MostSites)).toEqual([CHANCELLOR, CITIZEN])
        expect(playersMeetingOathkeeperGoal(state)).toEqual([CHANCELLOR])
    })

    it('leaves an Exile in the set alongside the Chancellor — it collapses the Empire only', () => {
        const state = table({
            oathType: OathType.Supremacy,
            warbandsBySite: { c1: { [IMPERIAL_COLOR]: 2 }, c2: { [Color.Red]: 1 } }
        })
        expect(playersMeetingOathkeeperGoal(state)).toEqual([CHANCELLOR, EXILE])
    })

    it('does not touch the other three Oaths — a Citizen can hold those titles (R-6.6.2)', () => {
        const state = table({
            oathType: OathType.Devotion,
            banners: testBanners({ [Banner.DarkestSecret]: CITIZEN })
        })
        expect(playersMeetingOathkeeperGoal(state)).toEqual([CITIZEN])
    })

    it('is not applied to a Vision goal — R-2.11.d is about the title (R-3.2.a)', () => {
        const state = table({
            warbandsBySite: { c1: { [IMPERIAL_COLOR]: 2 }, c2: { [IMPERIAL_COLOR]: 1 } }
        })
        expect(playersMeetingGoal(state, Goal.MostSites)).toEqual([CHANCELLOR, CITIZEN])
    })
})

describe('the Vision goal and its universal gate (R-3.2, R-3.2.a)', () => {
    it('requires three Visions drawn, whichever Vision it is (R-3.2)', () => {
        const holding = {
            [EXILE]: { revealedVisionId: 'vision.faith' }
        }
        const banners = testBanners({ [Banner.DarkestSecret]: EXILE })

        for (let drawn = 0; drawn < VISIONS_DRAWN_GATE; drawn += 1) {
            const short = table({ visionsDrawn: drawn, banners }, holding)
            expect(meetsRevealedVisionGoal(short, EXILE)).toBe(false)
        }

        const gated = table({ visionsDrawn: VISIONS_DRAWN_GATE, banners }, holding)
        expect(meetsRevealedVisionGoal(gated, EXILE)).toBe(true)
    })

    it('gates Conquest too — the gate is not Faith-specific (R-3.2)', () => {
        const holding = { [EXILE]: { revealedVisionId: 'vision.conquest' } }
        const warbandsBySite = { c1: { [Color.Red]: 1 } }

        expect(
            meetsRevealedVisionGoal(table({ visionsDrawn: 2, warbandsBySite }, holding), EXILE)
        ).toBe(false)
        expect(
            meetsRevealedVisionGoal(table({ visionsDrawn: 3, warbandsBySite }, holding), EXILE)
        ).toBe(true)
    })

    /** R-3.2-H1 — unlike the title, whose ties R-2.11.b resolves, a win needs sole superiority. */
    it('R-3.2-H1 — a Visionary tied for the count does not meet the goal', () => {
        const holding = { [EXILE]: { revealedVisionId: 'vision.conquest' } }

        const tied = table(
            {
                visionsDrawn: 3,
                warbandsBySite: {
                    c1: { [Color.Red]: 1 },
                    c2: { [IMPERIAL_COLOR]: 1 }
                }
            },
            holding
        )
        expect(meetsRevealedVisionGoal(tied, EXILE)).toBe(false)

        const ahead = table(
            {
                visionsDrawn: 3,
                warbandsBySite: {
                    c1: { [Color.Red]: 1 },
                    p1: { [Color.Red]: 1 },
                    c2: { [IMPERIAL_COLOR]: 1 }
                }
            },
            holding
        )
        expect(meetsRevealedVisionGoal(ahead, EXILE)).toBe(true)
    })

    it('is false for a player with no revealed Vision (R-2.2.1)', () => {
        const state = table({ visionsDrawn: 5 })
        expect(meetsRevealedVisionGoal(state, EXILE)).toBe(false)
    })

    it('is false when the Vision is revealed but its goal is unmet (R-3.2.a)', () => {
        const state = table(
            { visionsDrawn: 5, banners: testBanners({ [Banner.PeoplesFavor]: OTHER_EXILE }) },
            { [EXILE]: { revealedVisionId: 'vision.rebellion' } }
        )
        expect(meetsRevealedVisionGoal(state, EXILE)).toBe(false)
    })
})

describe('the Successor goal — Citizens only, keyed to the sworn Oath (R-3.3.1)', () => {
    it('Supremacy needs strictly MORE relics and banners, not tied-most', () => {
        const tied = table(
            { oathType: OathType.Supremacy },
            { [CITIZEN]: { relicIds: [CUP] }, [CHANCELLOR]: { relicIds: [CROWN] } }
        )
        expect(meetsSuccessorGoal(tied, CITIZEN)).toBe(false)

        const ahead = table(
            { oathType: OathType.Supremacy },
            { [CITIZEN]: { relicIds: [CUP, EYE] }, [CHANCELLOR]: { relicIds: [CROWN] } }
        )
        expect(meetsSuccessorGoal(ahead, CITIZEN)).toBe(true)
    })

    it('Supremacy compares against the Chancellor and Citizens only, never Exiles', () => {
        const state = table(
            { oathType: OathType.Supremacy },
            {
                [CITIZEN]: { relicIds: [CUP] },
                [EXILE]: { relicIds: [CROWN, EYE, 'relic.test'] }
            }
        )
        expect(meetsSuccessorGoal(state, CITIZEN)).toBe(true)
    })

    it('Supremacy counts relics and banners in total, not relics alone (R-3.3.1)', () => {
        const state = table(
            {
                oathType: OathType.Supremacy,
                banners: testBanners({ [Banner.PeoplesFavor]: CHANCELLOR })
            },
            { [CITIZEN]: { relicIds: [CUP] }, [CHANCELLOR]: { relicIds: [CROWN] } }
        )
        expect(meetsSuccessorGoal(state, CITIZEN)).toBe(false)
    })

    it('is deliberately different from that Oath’s Oathkeeper goal', () => {
        // Supremacy's Oathkeeper goal counts sites; its Successor goal counts relics and banners.
        const state = table(
            {
                oathType: OathType.Supremacy,
                warbandsBySite: { c1: { [Color.Red]: 1 } }
            },
            { [CITIZEN]: { relicIds: [CUP] } }
        )
        expect(playersMeetingOathkeeperGoal(state)).toEqual([EXILE])
        expect(meetsSuccessorGoal(state, CITIZEN)).toBe(true)
    })

    it('The People wants the Darkest Secret — the OTHER banner (R-3.3.1)', () => {
        const right = table({
            oathType: OathType.ThePeople,
            banners: testBanners({ [Banner.DarkestSecret]: CITIZEN })
        })
        expect(meetsSuccessorGoal(right, CITIZEN)).toBe(true)

        const wrong = table({
            oathType: OathType.ThePeople,
            banners: testBanners({ [Banner.PeoplesFavor]: CITIZEN })
        })
        expect(meetsSuccessorGoal(wrong, CITIZEN)).toBe(false)
    })

    it('Protection wants the People’s Favor — also swapped (R-3.3.1)', () => {
        const state = table({
            oathType: OathType.Protection,
            banners: testBanners({ [Banner.PeoplesFavor]: CITIZEN })
        })
        expect(meetsSuccessorGoal(state, CITIZEN)).toBe(true)
    })

    it('Devotion wants the Grand Scepter (R-3.3.1, R-6.4)', () => {
        const state = table(
            { oathType: OathType.Devotion },
            { [CITIZEN]: { relicIds: [GRAND_SCEPTER_ID] } }
        )
        expect(meetsSuccessorGoal(state, CITIZEN)).toBe(true)

        const without = table({ oathType: OathType.Devotion }, { [CITIZEN]: { relicIds: [CUP] } })
        expect(meetsSuccessorGoal(without, CITIZEN)).toBe(false)
    })

    it('is never met by an Exile or the Chancellor, however rich (R-3.3.1)', () => {
        const state = table(
            { oathType: OathType.Devotion },
            {
                [EXILE]: { relicIds: [GRAND_SCEPTER_ID] },
                [CHANCELLOR]: { relicIds: [GRAND_SCEPTER_ID] }
            }
        )
        expect(meetsSuccessorGoal(state, EXILE)).toBe(false)
        expect(meetsSuccessorGoal(state, CHANCELLOR)).toBe(false)
        expect(citizensMeetingSuccessorGoal(state)).toEqual([])
    })
})

describe('R-2.11.d — a Citizen can take the Supremacy title when the Chancellor does not qualify', () => {
    it('the Imperial-collapse filter does not fire when the Chancellor is not in the tie', () => {
        // Reachable only through R-6.6.2's purple shortage; R-2.11.d is unruled here, so its filter is read literally.
        const state = testState(
            [
                testPlayer({
                    playerId: 'chancellor',
                    color: Color.Purple,
                    status: PlayerStatus.Chancellor,
                    siteId: 'h1'
                }),
                testPlayer({
                    playerId: 'citizen',
                    color: Color.Blue,
                    status: PlayerStatus.Citizen,
                    siteId: 'c1'
                })
            ],
            {
                chancellorPlayerId: 'chancellor',
                warbandsBySite: {
                    c1: { [Color.Blue]: 1 },
                    c2: { [Color.Blue]: 1 },
                    h1: { purple: 1 }
                }
            }
        )
        expect(playersMeetingOathkeeperGoal(state)).toEqual(['citizen'])
    })
})
