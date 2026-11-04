import { describe, expect, it } from 'vitest'
import { Color, type Visibility } from '@tabletop/common'
import { Campaign, HydratedCampaign, type CampaignDefender } from './campaign.js'
import { PowerTiming, cardPowers, powerIndexOf } from '../data/cardPowers.js'
import { type CampaignTarget, CampaignTargetKind } from '../model/campaign.js'
import { HydratedOathGameState } from '../model/gameState.js'
import { PlayerStatus } from '../model/oathEnums.js'
import type { OathPlayerState } from '../model/playerState.js'
import { IMPERIAL_WARBANDS, type WarbandCounts } from '../model/warbandCounts.js'
import { reasonCannotDeclareTargets } from '../util/campaign.js'
import { legalChoices, PowerChoiceKind } from '../util/powerChoice.js'
import { CURRENT_OATH_REVISION, OathRevision } from '../util/revision.js'
import { OathVisibility } from '../definition/runtime.js'
import {
    CRADLE,
    HINTERLAND,
    PROVINCES,
    openTurn,
    testPlayer,
    testState
} from '../testing/fixture.js'
import { buildAction, joinDefence } from '../testing/actions.js'
import { actionPowerUse, site, siteTarget } from '../testing/choices.js'
import { ongoingCampaign, required } from '../testing/required.js'
import { served } from '../testing/projection.js'
import '../powers/index.js'

const CAPTAINS = 'denizen.order.captains'
const WILD_ALLIES = 'denizen.beast.wild-allies'
const WOLVES = 'denizen.beast.wolves'
const HIDDEN_PLACE = 'site.the-hidden-place'

const DANA = 'dana' // an Exile
const BEA = 'bea' // a Citizen, the attacker
const ANN = 'ann' // the Chancellor
const RHYS = 'rhys' // a second Citizen

const atRevision = CURRENT_OATH_REVISION
const before = OathRevision.EngineFixes9
const REVISIONS = [atRevision, before] as const

interface Scene {
    revision: number
    seats?: Partial<Record<string, Partial<OathPlayerState>>>
    siteCards?: Record<string, string>
    warbands?: Record<string, WarbandCounts>
    /** Where Captains is: c1 unless said. */
    captainsAt?: string
}

/**
 * Bea (a Citizen) at c1, where Captains is. The Empire's warbands alone hold c1, c2 (where a beast
 * card is, for Wild Allies) and p1, so Ann (the Chancellor) and every Imperial Citizen rule them
 * (R-6.6.3). Ann waits at h1, Rhys at h2. Dana (an Exile) waits at h3, where their own warbands are.
 */
function table(scene: Scene): HydratedOathGameState {
    const seat = (playerId: string) => scene.seats?.[playerId] ?? {}
    return testState(
        [
            testPlayer({
                playerId: BEA,
                color: Color.Blue,
                status: PlayerStatus.Citizen,
                siteId: 'c1',
                supply: 6,
                favor: 4,
                secrets: 3,
                warbandsOnBoard: { [IMPERIAL_WARBANDS]: 3 },
                warbandsInPersonalBank: {},
                ...seat(BEA)
            }),
            testPlayer({
                playerId: ANN,
                color: Color.Purple,
                status: PlayerStatus.Chancellor,
                siteId: 'h1',
                supply: 6,
                favor: 4,
                secrets: 3,
                warbandsOnBoard: { [IMPERIAL_WARBANDS]: 3 },
                warbandsInPersonalBank: { [IMPERIAL_WARBANDS]: 10 },
                ...seat(ANN)
            }),
            testPlayer({
                playerId: DANA,
                color: Color.Red,
                status: PlayerStatus.Exile,
                siteId: 'h3',
                supply: 6,
                favor: 4,
                secrets: 3,
                warbandsOnBoard: { [DANA]: 4 },
                warbandsInPersonalBank: { [DANA]: 8 },
                ...seat(DANA)
            }),
            testPlayer({
                playerId: RHYS,
                color: Color.Yellow,
                status: PlayerStatus.Citizen,
                siteId: 'h2',
                supply: 6,
                favor: 2,
                secrets: 1,
                warbandsOnBoard: { [IMPERIAL_WARBANDS]: 2 },
                warbandsInPersonalBank: {},
                ...seat(RHYS)
            })
        ],
        {
            oathRevision: scene.revision,
            chancellorPlayerId: ANN,
            denizensBySite: {
                c1: [],
                c2: [WOLVES],
                p1: [],
                h1: [],
                [scene.captainsAt ?? 'c1']: [CAPTAINS]
            },
            warbandsBySite: {
                c1: { [IMPERIAL_WARBANDS]: 1 },
                c2: { [IMPERIAL_WARBANDS]: 2 },
                p1: { [IMPERIAL_WARBANDS]: 1 },
                h1: { [IMPERIAL_WARBANDS]: 1 },
                h3: { [DANA]: 2 },
                ...scene.warbands
            },
            siteCards: {
                ...Object.fromEntries(
                    [...CRADLE, ...PROVINCES, ...HINTERLAND].map((slotId) => [slotId, slotId])
                ),
                ...scene.siteCards
            },
            prng: { seed: 1, invocations: 0 }
        }
    )
}

/** `cardId` used on `siteId`: the next action is the free Campaign from there. */
function namedAt(s: HydratedOathGameState, playerId: string, cardId: string, siteId: string) {
    openTurn(s, playerId)
    actionPowerUse(playerId, cardId, [site(siteId)]).apply(s)
    s.actionCount += 1
    return s
}

const against = (playerId: string): CampaignDefender => ({ kind: 'player', playerId })
const pawnAndFavor: CampaignTarget = { kind: CampaignTargetKind.PawnAndFavor }

/** The refusal of the targets as the table checks them, then of the whole declaration. */
function refusal(
    s: HydratedOathGameState,
    attackerId: string,
    defender: CampaignDefender,
    targets: CampaignTarget[]
) {
    return (
        reasonCannotDeclareTargets(
            s,
            HydratedCampaign.partiesFor(s, attackerId, { defender, targets })
        ) ??
        HydratedCampaign.reasonCannotCampaign(s, attackerId, { defender, targets, attackDice: 3 })
    )
}

function declare(
    s: HydratedOathGameState,
    attackerId: string,
    defender: CampaignDefender,
    targets: CampaignTarget[]
) {
    new HydratedCampaign(
        buildAction(Campaign, { playerId: attackerId, defender, targets, attackDice: 3 })
    ).apply(s)
}

const withBeaWildAllies = (scene: Scene): Scene => ({
    ...scene,
    seats: {
        ...scene.seats,
        [BEA]: { ...scene.seats?.[BEA], advisers: [{ cardId: WILD_ALLIES, faceUp: true }] }
    }
})

describe('R-5.5.2-H2 — a Citizen outside the Empire, campaigning from a site Captains or Wild Allies names, need not target it', () => {
    for (const cardId of [CAPTAINS, WILD_ALLIES]) {
        const scene = (revision: number, seats: Scene['seats'] = {}): Scene =>
            cardId === WILD_ALLIES ? withBeaWildAllies({ revision, seats }) : { revision, seats }

        it(`${cardId}: Ann’s pawn at the named site c2, Bea may target only Ann’s pawn and favor; before revision 14 they had to target c2`, () => {
            const fixed = namedAt(
                table(scene(atRevision, { [ANN]: { siteId: 'c2' } })),
                BEA,
                cardId,
                'c2'
            )
            expect(refusal(fixed, BEA, against(ANN), [pawnAndFavor])).toBeUndefined()
            declare(fixed, BEA, against(ANN), [pawnAndFavor])
            expect(ongoingCampaign(fixed).asIfSiteId).toBe('c2')
            expect(ongoingCampaign(fixed).targets).toEqual([pawnAndFavor])

            const recorded = namedAt(
                table(scene(before, { [ANN]: { siteId: 'c2' } })),
                BEA,
                cardId,
                'c2'
            )
            expect(refusal(recorded, BEA, against(ANN), [pawnAndFavor])).toMatch(
                /the defender rules c2, so you must target your site/
            )
        })

        it(`${cardId}: Ann’s pawn away, Bea may target p1, a site Ann rules elsewhere, and not c2; no target at all is still refused`, () => {
            const fixed = namedAt(table(scene(atRevision)), BEA, cardId, 'c2')
            expect(refusal(fixed, BEA, against(ANN), [siteTarget('p1')])).toBeUndefined()
            expect(refusal(fixed, BEA, against(ANN), [siteTarget('c2')])).toBeUndefined()
            expect(refusal(fixed, BEA, against(ANN), [])).toMatch(
                /must declare at least one target/
            )
            // Pawn and favor still need Ann's pawn at the named site (Law 5.5.2; "Act as if your pawn is there").
            expect(refusal(fixed, BEA, against(ANN), [siteTarget('p1'), pawnAndFavor])).toMatch(
                /the defender's pawn is not at your site/
            )
            declare(fixed, BEA, against(ANN), [siteTarget('p1')])
            expect(ongoingCampaign(fixed).targets).toEqual([siteTarget('p1')])

            const recorded = namedAt(table(scene(before)), BEA, cardId, 'c2')
            expect(refusal(recorded, BEA, against(ANN), [siteTarget('p1')])).toMatch(
                /must declare at least one target at your site/
            )
        })

        it(`${cardId}: against Rhys, a Citizen, the same waiver`, () => {
            const fixed = namedAt(table(scene(atRevision)), BEA, cardId, 'c2')
            expect(refusal(fixed, BEA, against(RHYS), [siteTarget('p1')])).toBeUndefined()
            const recorded = namedAt(table(scene(before)), BEA, cardId, 'c2')
            expect(refusal(recorded, BEA, against(RHYS), [siteTarget('p1')])).toMatch(
                /must declare at least one target at your site/
            )
        })
    }

    it('Captains named at The Hidden Place: Bea, with no faceup secret, is offered it and campaigns against a site elsewhere with no flip', () => {
        const scene = (revision: number): Scene => ({
            revision,
            siteCards: { c2: HIDDEN_PLACE },
            seats: { [BEA]: { secrets: 0 } }
        })
        const offered = (s: HydratedOathGameState) => {
            openTurn(s, BEA)
            const power = required(
                cardPowers(CAPTAINS)[powerIndexOf(CAPTAINS, PowerTiming.Action)],
                'Captains’ Action power'
            )
            return legalChoices(s, BEA, power).flatMap((legal) =>
                legal.options.flatMap((option) =>
                    option.kind === PowerChoiceKind.Site ? [option.siteId] : []
                )
            )
        }
        expect(offered(table(scene(atRevision)))).toContain('c2')
        expect(offered(table(scene(before)))).not.toContain('c2')

        const s = namedAt(table(scene(atRevision)), BEA, CAPTAINS, 'c2')
        expect(refusal(s, BEA, against(ANN), [siteTarget('p1')])).toBeUndefined()
        declare(s, BEA, against(ANN), [siteTarget('p1')])
        expect(s.getPlayerState(BEA).secrets).toBe(0)
        expect(ongoingCampaign(s).targets).toEqual([siteTarget('p1')])
    })
})

describe('R-5.5.2-H2 — controls: Law 5.5.2’s demands at your site stand for everyone else', () => {
    for (const revision of REVISIONS) {
        it(`revision ${revision}: Dana, an Exile at p2 naming h3 with Captains against Ann there, must still target h3`, () => {
            const s = table({
                revision,
                captainsAt: 'h3',
                seats: { [DANA]: { siteId: 'p2' }, [ANN]: { siteId: 'h3' } },
                warbands: { h3: { [DANA]: 2, [IMPERIAL_WARBANDS]: 1 } }
            })
            namedAt(s, DANA, CAPTAINS, 'h3')
            expect(refusal(s, DANA, against(ANN), [siteTarget('h3'), pawnAndFavor])).toBeUndefined()
            expect(refusal(s, DANA, against(ANN), [pawnAndFavor])).toMatch(
                /the defender rules h3, so you must target your site/
            )
            expect(refusal(s, DANA, against(ANN), [siteTarget('p1')])).toMatch(
                /must declare at least one target at your site/
            )
        })

        it(`revision ${revision}: Bea campaigning from their own pawn's site must still target c1`, () => {
            const s = table({ revision })
            openTurn(s, BEA)
            expect(refusal(s, BEA, against(RHYS), [siteTarget('c1')])).toBeUndefined()
            expect(refusal(s, BEA, against(ANN), [siteTarget('p1')])).toMatch(
                /must declare at least one target at your site/
            )
            expect(refusal(s, BEA, against(RHYS), [siteTarget('p1')])).toMatch(
                /must declare at least one target at your site/
            )
        })

        it(`revision ${revision}: Bea’s Wild Allies against the bandits must still target the named site`, () => {
            const s = table(withBeaWildAllies({ revision, warbands: { c2: {} } }))
            namedAt(s, BEA, WILD_ALLIES, 'c2')
            expect(refusal(s, BEA, { kind: 'bandits' }, [siteTarget('c2')])).toBeUndefined()
            expect(refusal(s, BEA, { kind: 'bandits' }, [siteTarget('p2')])).toMatch(
                /must declare at least one target at your site/
            )
        })
    }
})

describe('Law 5.5.2 — under Captains, the Citizens who may join are those at the named site or a targeted site', () => {
    /** Bea names c2 with Captains against Ann; Rhys stands at `rhysAt`. */
    function asked(rhysAt: string, targets: CampaignTarget[]) {
        const s = namedAt(
            table({ revision: atRevision, seats: { [RHYS]: { siteId: rhysAt } } }),
            BEA,
            CAPTAINS,
            'c2'
        )
        return {
            s,
            asked: HydratedCampaign.optionalAllies(
                s,
                HydratedCampaign.partiesFor(s, BEA, { defender: against(ANN), targets })
            )
        }
    }

    it('Rhys at the named site c2 is asked, and once admitted their board defends', () => {
        const { s, asked: toAsk } = asked('c2', [siteTarget('p1')])
        expect(toAsk).toEqual([RHYS])
        declare(s, BEA, against(ANN), [siteTarget('p1')])
        joinDefence(s, RHYS, ANN)
        const campaign = ongoingCampaign(s)
        expect(campaign.allyPlayerIds).toContain(RHYS)
        expect(campaign.defendingForce).toContainEqual({
            at: { kind: 'board', playerId: RHYS },
            owner: IMPERIAL_WARBANDS,
            count: 2
        })
    })

    it('Rhys at Bea’s real pawn site c1 is not asked unless c1 is targeted', () => {
        expect(asked('c1', [siteTarget('p1')]).asked).toEqual([])
        expect(asked('c1', [siteTarget('c1')]).asked).toEqual([RHYS])
    })

    it('Rhys at a targeted site elsewhere, p1, is asked', () => {
        expect(asked('p1', [siteTarget('p1')]).asked).toEqual([RHYS])
    })
})

describe('R-5.5.2-H2 on Bea’s own view', () => {
    const bea: Visibility.Perspective = { kind: 'player', playerId: BEA }
    const ownView = (s: HydratedOathGameState) =>
        OathVisibility.state.guardForExecution(new HydratedOathGameState(served(s, bea)), bea)

    /** The same answer on the server and on Bea's view, and neither changes the state or what they are served. */
    function sameOnOwnView<T>(
        s: HydratedOathGameState,
        check: (state: HydratedOathGameState) => T,
        expected: T
    ) {
        const server = JSON.stringify(s.dehydrate())
        const seen = JSON.stringify(served(s, bea))
        expect(check(s)).toEqual(expected)
        expect(check(ownView(s))).toEqual(expected)
        expect(JSON.stringify(s.dehydrate())).toBe(server)
        expect(JSON.stringify(served(s, bea))).toBe(seen)
    }

    it('the targets check accepts a site elsewhere, and the Captains offer at The Hidden Place stands, as on the server', () => {
        // Ann holds a facedown adviser, so Bea's view does not hold everything.
        const seats = {
            [BEA]: { secrets: 0 },
            [ANN]: { advisers: [{ cardId: 'denizen.hearth.storyteller', faceUp: false }] }
        }
        const named = namedAt(
            table({ revision: atRevision, seats, siteCards: { c2: HIDDEN_PLACE } }),
            BEA,
            CAPTAINS,
            'c2'
        )
        sameOnOwnView(
            named,
            (state) =>
                reasonCannotDeclareTargets(
                    state,
                    HydratedCampaign.partiesFor(state, BEA, {
                        defender: against(ANN),
                        targets: [siteTarget('p1')]
                    })
                ),
            undefined
        )
        sameOnOwnView(
            named,
            (state) =>
                reasonCannotDeclareTargets(
                    state,
                    HydratedCampaign.partiesFor(state, BEA, { defender: against(ANN), targets: [] })
                ),
            'must declare at least one target'
        )

        const fresh = table({ revision: atRevision, seats, siteCards: { c2: HIDDEN_PLACE } })
        openTurn(fresh, BEA)
        const power = required(
            cardPowers(CAPTAINS)[powerIndexOf(CAPTAINS, PowerTiming.Action)],
            'Captains’ Action power'
        )
        sameOnOwnView(
            fresh,
            (state) =>
                legalChoices(state, BEA, power)
                    .flatMap((legal) =>
                        legal.options.flatMap((option) =>
                            option.kind === PowerChoiceKind.Site ? [option.siteId] : []
                        )
                    )
                    .includes('c2'),
            true
        )
    })
})
