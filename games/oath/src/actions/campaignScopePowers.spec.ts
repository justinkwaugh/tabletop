import { describe, expect, it } from 'vitest'
import { Color, type Visibility } from '@tabletop/common'
import { Campaign, HydratedCampaign, type CampaignDefender } from './campaign.js'
import { HydratedCampaignDefend } from './campaignDefend.js'
import { CampaignSacrifice, HydratedCampaignSacrifice } from './campaignSacrifice.js'
import { CampaignResolveVictory, HydratedCampaignResolveVictory } from './campaignResolveVictory.js'
import { HydratedTravel, Travel } from './travel.js'
import { HydratedUseActionPower, UseActionPower } from './useActionPower.js'
import { PowerTiming, powerIndexOf } from '../data/cardPowers.js'
import { type CampaignTarget, CampaignTargetKind } from '../model/campaign.js'
import { HydratedOathGameState } from '../model/gameState.js'
import { Banner, PlayerStatus, Suit } from '../model/oathEnums.js'
import type { OathPlayerState } from '../model/playerState.js'
import { PowerQuestionKind } from '../model/question.js'
import { IMPERIAL_WARBANDS, type WarbandCounts } from '../model/warbandCounts.js'
import { reasonCannotDeclareTargets } from '../util/campaign.js'
import { CURRENT_OATH_REVISION, OathRevision } from '../util/revision.js'
import { OathVisibility } from '../definition/runtime.js'
import {
    CRADLE,
    HINTERLAND,
    PROVINCES,
    openTurn,
    testBanners,
    testPlayer,
    testState,
    testVaultWithRelics
} from '../testing/fixture.js'
import { buildAction, defendingSideChooses, joinDefence } from '../testing/actions.js'
import { actionPowerUse, bank, battlePlanUse, site, siteTarget } from '../testing/choices.js'
import { ongoingCampaign } from '../testing/required.js'
import { answerQuestion, defend } from '../testing/steps.js'
import { served } from '../testing/projection.js'
import '../powers/index.js'

const JINX = 'denizen.arcane.jinx'
const SPELL_BREAKER = 'denizen.nomad.spell-breaker'
const TOME_GUARDIANS = 'denizen.order.tome-guardians'
const LOST_TONGUE = 'denizen.nomad.lost-tongue'
const BEAST_TAMER = 'denizen.discord.beast-tamer'
const GLEAMING_ARMOR = 'denizen.arcane.gleaming-armor'
const INSECT_SWARM = 'denizen.beast.insect-swarm'
const ANCIENT_BLOODLINE = 'denizen.nomad.ancient-bloodline'
const GRASPING_VINES = 'denizen.beast.grasping-vines'
const BOILING_LAKE = 'denizen.discord.boiling-lake'
const TOLL_ROADS = 'denizen.order.toll-roads'
const HOSPITAL = 'denizen.hearth.hospital'
const VOW_OF_UNION = 'denizen.beast.vow-of-union'
const HERALD = 'denizen.hearth.herald'
const GAMBLING_HALL = 'denizen.discord.gambling-hall'
const CAPTAINS = 'denizen.order.captains'
/** Arcane, either side, costs a secret. */
const KINDRED_WARRIORS = 'denizen.arcane.kindred-warriors'
/** Nomad, either side, free. */
const HORSE_ARCHERS = 'denizen.nomad.horse-archers'
/** Order, defender, free. */
const BEAR_TRAPS = 'denizen.order.bear-traps'
const RELIC_HUNTER = 'denizen.order.relic-hunter'
/** A nomad card, the only one in these scenes. */
const TENTS = 'denizen.nomad.tents'
const RELIC = 'relic.book-of-records'
const NARROW_PASS = 'site.narrow-pass'
const HIDDEN_PLACE = 'site.the-hidden-place'
const SHROUDED_WOOD = 'site.shrouded-wood'

const DANA = 'dana' // an Exile
const BEA = 'bea' // a Citizen
const ANN = 'ann' // the Chancellor
const RHYS = 'rhys' // a second Citizen

const atRevision = CURRENT_OATH_REVISION
const before = OathRevision.EngineFixes9
const REVISIONS = [atRevision, before] as const

const FIXTURE_SITES = [...CRADLE, ...PROVINCES, ...HINTERLAND]

interface Scene {
    revision: number
    /** The cards at p1, a site only the Empire's warbands rule. */
    atEmpireSite?: string[]
    denizens?: Record<string, string[]>
    warbands?: Record<string, WarbandCounts>
    siteCards?: Record<string, string>
    banners?: Partial<Record<Banner, string>>
    seats?: Partial<Record<string, Partial<OathPlayerState>>>
    relicAtP1?: boolean
}

const faceup = (cardIds: string[]) => cardIds.map((cardId) => ({ cardId, faceUp: true }))

/**
 * Bea (a Citizen), Ann (the Chancellor) and Dana (an Exile) at c1; Rhys (a Citizen) away at h2. A
 * Citizen has no colour of their own (R-6.6.2), so Bea's and Rhys's boards hold the Empire's warbands.
 * The Empire's warbands alone hold c1 and p1, so Bea and Rhys rule them only as Imperial players;
 * Dana rules nothing. Ann holds a facedown adviser, so no player's view holds everything.
 */
function table(scene: Scene): HydratedOathGameState {
    const seat = (playerId: string) => scene.seats?.[playerId] ?? {}
    const s = testState(
        [
            testPlayer({
                playerId: BEA,
                color: Color.Blue,
                status: PlayerStatus.Citizen,
                siteId: 'c1',
                supply: 6,
                favor: 4,
                secrets: 3,
                warbandsOnBoard: { [IMPERIAL_WARBANDS]: 6 },
                warbandsInPersonalBank: {},
                ...seat(BEA)
            }),
            testPlayer({
                playerId: ANN,
                color: Color.Purple,
                status: PlayerStatus.Chancellor,
                siteId: 'c1',
                supply: 6,
                favor: 4,
                secrets: 3,
                warbandsOnBoard: { [IMPERIAL_WARBANDS]: 4 },
                warbandsInPersonalBank: { [IMPERIAL_WARBANDS]: 10 },
                advisers: [{ cardId: 'denizen.hearth.storyteller', faceUp: false }],
                ...seat(ANN)
            }),
            testPlayer({
                playerId: DANA,
                color: Color.Red,
                status: PlayerStatus.Exile,
                siteId: 'c1',
                supply: 6,
                favor: 4,
                secrets: 3,
                warbandsOnBoard: { [DANA]: 6 },
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
            banners: testBanners(scene.banners),
            denizensBySite: {
                c1: [],
                c2: [],
                p1: scene.atEmpireSite ?? [],
                p2: [],
                h1: [],
                ...scene.denizens
            },
            warbandsBySite: {
                c1: { [IMPERIAL_WARBANDS]: 2 },
                p1: { [IMPERIAL_WARBANDS]: 1 },
                ...scene.warbands
            },
            siteCards: {
                ...Object.fromEntries(FIXTURE_SITES.map((slotId) => [slotId, slotId])),
                ...scene.siteCards
            },
            relicsBySite: scene.relicAtP1 ? { p1: [{ slotId: 'p1-r1' }] } : {},
            vault: testVaultWithRelics(scene.relicAtP1 ? { 'p1-r1': RELIC } : {}),
            prng: { seed: 1, invocations: 0 }
        }
    )
    return s
}

/** Dana's attacks: Bea, a Citizen, waits at h3, where they are not asked to join the defence (R-5.5.2.a). */
const beaAway = (scene: Scene): Scene => ({
    ...scene,
    seats: { ...scene.seats, [BEA]: { ...scene.seats?.[BEA], siteId: 'h3' } }
})

const against = (playerId: string): CampaignDefender => ({ kind: 'player', playerId })
const pawnAndFavor: CampaignTarget = { kind: CampaignTargetKind.PawnAndFavor }
const banner = (which: Banner): CampaignTarget => ({
    kind: CampaignTargetKind.Banner,
    banner: which
})

interface Declaration {
    targets: CampaignTarget[]
    plans?: string[]
    flipSecret?: boolean
    attackDice?: number
}

/** The attacker's refusal at the declaration, as the table checks it. */
function refusal(
    s: HydratedOathGameState,
    attackerId: string,
    defenderId: string,
    declared: Declaration
) {
    openTurn(s, attackerId)
    return HydratedCampaign.reasonCannotCampaign(s, attackerId, {
        defender: against(defenderId),
        targets: declared.targets,
        attackDice: declared.attackDice ?? 3,
        plans: (declared.plans ?? []).map(battlePlanUse),
        flipSecret: declared.flipSecret
    })
}

function declare(
    s: HydratedOathGameState,
    attackerId: string,
    defender: CampaignDefender,
    declared: Declaration
) {
    openTurn(s, attackerId)
    new HydratedCampaign(
        buildAction(Campaign, {
            playerId: attackerId,
            defender,
            targets: declared.targets,
            attackDice: declared.attackDice ?? 3,
            plans: (declared.plans ?? []).map(battlePlanUse),
            flipSecret: declared.flipSecret
        })
    ).apply(s)
}

/** Who Jinx offers a reroll of the Campaign's roll, in the order asked. */
const offeredJinx = (s: HydratedOathGameState) =>
    (s.pendingQuestions?.queue ?? [])
        .filter((question) => question.kind === PowerQuestionKind.RerollDice)
        .map((question) => question.askedPlayerId)

const boardOf = (s: HydratedOathGameState, playerId: string, owner: string) =>
    s.getPlayerState(playerId).warbandsOnBoard[owner] ?? 0

describe('R-5.5.1.a-H2 — Jinx at a site only the Empire rules is judged in the Campaign’s scope', () => {
    it('Bea attacking Ann: only Ann is offered the reroll; before revision 14 Bea was offered it too', () => {
        const scoped = table({ revision: atRevision, atEmpireSite: [JINX] })
        declare(scoped, BEA, against(ANN), { targets: [siteTarget('c1')] })
        expect(offeredJinx(scoped)).toEqual([ANN])
        // R-5.5.4-H1 — Ann, defending, is asked before the attack is rolled.
        expect(ongoingCampaign(scoped).attackRoll).toEqual([])

        const recorded = table({ revision: before, atEmpireSite: [JINX] })
        declare(recorded, BEA, against(ANN), { targets: [siteTarget('c1')] })
        expect(offeredJinx(recorded)).toEqual([BEA, ANN])
    })

    it('Ann attacking Bea: Bea is not offered the reroll of the defence roll; before revision 14 Bea was', () => {
        const scoped = table({ revision: atRevision, atEmpireSite: [JINX] })
        declare(scoped, ANN, against(BEA), { targets: [pawnAndFavor] })
        expect(offeredJinx(scoped)).toEqual([ANN])
        expect(ongoingCampaign(scoped).attackRoll).toHaveLength(ongoingCampaign(scoped).attackPool)

        const recorded = table({ revision: before, atEmpireSite: [JINX] })
        declare(recorded, ANN, against(BEA), { targets: [pawnAndFavor] })
        expect(offeredJinx(recorded)).toEqual([ANN, BEA])
    })

    it('control: Dana, an Exile, attacking Ann is not offered it at either revision', () => {
        for (const revision of REVISIONS) {
            const s = table(beaAway({ revision, atEmpireSite: [JINX] }))
            declare(s, DANA, against(ANN), { targets: [siteTarget('c1')] })
            expect(offeredJinx(s), `revision ${revision}`).toEqual([ANN])
        }
    })

    it('control: Rhys, a Citizen nobody suspends, still rules the Empire’s site cards when Dana attacks them', () => {
        for (const revision of REVISIONS) {
            const s = table(
                beaAway({ revision, atEmpireSite: [JINX], seats: { [RHYS]: { siteId: 'c1' } } })
            )
            declare(s, DANA, against(RHYS), { targets: [siteTarget('c1')] })
            expect(offeredJinx(s), `revision ${revision}`).toEqual([RHYS])
        }
    })

    it('control: Bea attacking the bandits has no scope, and is offered it at either revision', () => {
        for (const revision of REVISIONS) {
            const s = table({ revision, atEmpireSite: [JINX], seats: { [BEA]: { siteId: 'c2' } } })
            declare(s, BEA, { kind: 'bandits' }, { targets: [siteTarget('c2')] })
            expect(offeredJinx(s), `revision ${revision}`).toEqual([BEA])
        }
    })

    it('control: outside a Campaign, Bea rolling for Gambling Hall at the Empire’s site is offered it', () => {
        for (const revision of REVISIONS) {
            const s = table({
                revision,
                atEmpireSite: [JINX, GAMBLING_HALL],
                seats: { [BEA]: { siteId: 'p1' } }
            })
            openTurn(s, BEA)
            actionPowerUse(BEA, GAMBLING_HALL, [bank(Suit.Discord)]).apply(s)
            expect(offeredJinx(s), `revision ${revision}`).toEqual([BEA])
        }
    })
})

describe('R-5.5.1.a-H2 — Spell Breaker at a site only the Empire rules bars the Citizen it suspends', () => {
    it('Bea attacking Ann cannot use a plan that costs a secret; before revision 14 they could', () => {
        const declared = { targets: [siteTarget('c1')], plans: [KINDRED_WARRIORS] }
        const seats = { [BEA]: { advisers: faceup([KINDRED_WARRIORS]) } }
        expect(
            refusal(
                table({ revision: atRevision, atEmpireSite: [SPELL_BREAKER], seats }),
                BEA,
                ANN,
                declared
            )
        ).toMatch(/Spell Breaker/)
        expect(
            refusal(
                table({ revision: before, atEmpireSite: [SPELL_BREAKER], seats }),
                BEA,
                ANN,
                declared
            )
        ).toBeUndefined()
    })

    it('nor a free plan Ann’s Gleaming Armor gives an added secret (Spell Breaker’s Q&A); before revision 14 they could', () => {
        const declared = { targets: [siteTarget('c1')], plans: [HORSE_ARCHERS] }
        const seats = {
            [BEA]: { advisers: faceup([HORSE_ARCHERS]) },
            [ANN]: { advisers: faceup([GLEAMING_ARMOR]) }
        }
        expect(
            refusal(
                table({ revision: atRevision, atEmpireSite: [SPELL_BREAKER], seats }),
                BEA,
                ANN,
                declared
            )
        ).toMatch(/Spell Breaker/)
        expect(
            refusal(
                table({ revision: before, atEmpireSite: [SPELL_BREAKER], seats }),
                BEA,
                ANN,
                declared
            )
        ).toBeUndefined()
    })

    it('nor flip a secret to target The Hidden Place; before revision 14 they could', () => {
        const scene = {
            atEmpireSite: [SPELL_BREAKER],
            siteCards: { c2: HIDDEN_PLACE },
            warbands: { c2: { [IMPERIAL_WARBANDS]: 1 } }
        }
        const declared = { targets: [siteTarget('c1'), siteTarget('c2')], flipSecret: true }
        expect(refusal(table({ revision: atRevision, ...scene }), BEA, ANN, declared)).toMatch(
            /Spell Breaker/
        )
        expect(refusal(table({ revision: before, ...scene }), BEA, ANN, declared)).toBeUndefined()
    })

    it('Ann attacking Bea: Bea’s defence plan that costs a secret is refused and not listed; before revision 14 it was used', () => {
        const seats = { [BEA]: { advisers: faceup([KINDRED_WARRIORS, BEAR_TRAPS]) } }
        const scoped = table({ revision: atRevision, atEmpireSite: [SPELL_BREAKER], seats })
        declare(scoped, ANN, against(BEA), { targets: [pawnAndFavor] })
        expect(
            HydratedCampaignDefend.reasonCannotDefend(scoped, BEA, [
                battlePlanUse(KINDRED_WARRIORS)
            ])
        ).toMatch(/Spell Breaker/)
        expect(
            HydratedCampaignDefend.usablePlans(scoped, BEA).map((power) => power.cardId)
        ).toEqual([BEAR_TRAPS])

        const recorded = table({ revision: before, atEmpireSite: [SPELL_BREAKER], seats })
        declare(recorded, ANN, against(BEA), { targets: [pawnAndFavor] })
        expect(
            HydratedCampaignDefend.reasonCannotDefend(recorded, BEA, [
                battlePlanUse(KINDRED_WARRIORS)
            ])
        ).toBeUndefined()
        defend([battlePlanUse(KINDRED_WARRIORS)], BEA).apply(recorded)
        expect(ongoingCampaign(recorded).plansUsed).toContain(KINDRED_WARRIORS)
    })

    it('control: Dana, an Exile, is refused the plan and the flip at either revision', () => {
        for (const revision of REVISIONS) {
            const seats = { [DANA]: { advisers: faceup([KINDRED_WARRIORS]) } }
            expect(
                refusal(
                    table(beaAway({ revision, atEmpireSite: [SPELL_BREAKER], seats })),
                    DANA,
                    ANN,
                    { targets: [siteTarget('c1')], plans: [KINDRED_WARRIORS] }
                )
            ).toMatch(/Spell Breaker/)
            const hidden = {
                atEmpireSite: [SPELL_BREAKER],
                siteCards: { c2: HIDDEN_PLACE },
                warbands: { c2: { [IMPERIAL_WARBANDS]: 1 } }
            }
            expect(
                refusal(table(beaAway({ revision, ...hidden })), DANA, ANN, {
                    targets: [siteTarget('c1'), siteTarget('c2')],
                    flipSecret: true
                })
            ).toMatch(/Spell Breaker/)
        }
    })

    it('control: Rhys, joining Ann’s defence as a Citizen nobody suspends, uses a plan that costs a secret', () => {
        const s = table({
            revision: atRevision,
            atEmpireSite: [SPELL_BREAKER],
            seats: { [RHYS]: { siteId: 'c1', advisers: faceup([KINDRED_WARRIORS]) } }
        })
        declare(s, BEA, against(ANN), { targets: [siteTarget('c1')] })
        joinDefence(s, RHYS, ANN)
        expect(HydratedCampaignDefend.answeringPlayerId(s)).toBe(RHYS)
        expect(
            HydratedCampaignDefend.reasonCannotDefend(s, RHYS, [battlePlanUse(KINDRED_WARRIORS)])
        ).toBeUndefined()
    })
})

describe('R-5.5.1.a-H2 — Captains names a site the Empire rules: its warbands, not its cards (R-5.5.1.a-H1)', () => {
    /** Bea uses Captains (at c1) to campaign from p1, where Jinx and Spell Breaker stand. */
    function fromTheEmpiresSite(revision: number) {
        const s = table({
            revision,
            denizens: { c1: [CAPTAINS] },
            atEmpireSite: [JINX, SPELL_BREAKER],
            seats: { [BEA]: { advisers: faceup([KINDRED_WARRIORS]) } }
        })
        openTurn(s, BEA)
        new HydratedUseActionPower(
            buildAction(UseActionPower, {
                playerId: BEA,
                cardId: CAPTAINS,
                powerIndex: powerIndexOf(CAPTAINS, PowerTiming.Action),
                choices: [site('p1')]
            })
        ).apply(s)
        s.actionCount += 1
        return s
    }

    it('Bea acting from p1 does not rule Spell Breaker or Jinx there; before revision 14 they did', () => {
        const declared = { targets: [siteTarget('p1')], plans: [KINDRED_WARRIORS] }
        expect(refusal(fromTheEmpiresSite(atRevision), BEA, ANN, declared)).toMatch(/Spell Breaker/)
        expect(refusal(fromTheEmpiresSite(before), BEA, ANN, declared)).toBeUndefined()

        const scoped = fromTheEmpiresSite(atRevision)
        declare(scoped, BEA, against(ANN), { targets: [siteTarget('p1')] })
        expect(ongoingCampaign(scoped).asIfSiteId).toBe('p1')
        expect(offeredJinx(scoped)).toEqual([ANN])

        const recorded = fromTheEmpiresSite(before)
        declare(recorded, BEA, against(ANN), { targets: [siteTarget('p1')] })
        expect(offeredJinx(recorded)).toEqual([BEA, ANN])
    })
})

describe('R-5.5.1.a-H2 — target checks in the Campaign’s scope, from the declaration', () => {
    it('Tome Guardians at the Empire’s site: Bea attacking Ann cannot target the Darkest Secret Ann holds', () => {
        const scene = { atEmpireSite: [TOME_GUARDIANS], banners: { [Banner.DarkestSecret]: ANN } }
        const declared = { targets: [siteTarget('c1'), banner(Banner.DarkestSecret)] }
        expect(refusal(table({ revision: atRevision, ...scene }), BEA, ANN, declared)).toMatch(
            /Tome Guardians/
        )
        expect(refusal(table({ revision: before, ...scene }), BEA, ANN, declared)).toBeUndefined()
        for (const revision of REVISIONS) {
            expect(
                refusal(table(beaAway({ revision, ...scene })), DANA, ANN, declared),
                `revision ${revision}`
            ).toMatch(/Tome Guardians/)
        }
    })

    it('Lost Tongue as Ann’s adviser, the only nomad card at the Empire’s site: Bea cannot target Ann’s relic or banner', () => {
        const scene = {
            atEmpireSite: [TENTS],
            banners: { [Banner.PeoplesFavor]: ANN },
            seats: { [ANN]: { advisers: faceup([LOST_TONGUE]), relicIds: [RELIC] } }
        }
        for (const target of [
            { kind: CampaignTargetKind.Relic as const, cardId: RELIC },
            banner(Banner.PeoplesFavor)
        ]) {
            const declared = { targets: [siteTarget('c1'), target] }
            expect(refusal(table({ revision: atRevision, ...scene }), BEA, ANN, declared)).toMatch(
                /Lost Tongue/
            )
            expect(
                refusal(table({ revision: before, ...scene }), BEA, ANN, declared)
            ).toBeUndefined()
            for (const revision of REVISIONS) {
                expect(
                    refusal(table(beaAway({ revision, ...scene })), DANA, ANN, declared),
                    `revision ${revision}`
                ).toMatch(/Lost Tongue/)
            }
        }
    })

    it('Beast Tamer as Ann’s adviser: Bea attacking Ann cannot use a nomad plan; before revision 14 they could', () => {
        const declared = { targets: [siteTarget('c1')], plans: [HORSE_ARCHERS] }
        const seats = {
            [BEA]: { advisers: faceup([HORSE_ARCHERS]) },
            [DANA]: { advisers: faceup([HORSE_ARCHERS]) },
            [ANN]: { advisers: faceup([BEAST_TAMER]) }
        }
        expect(refusal(table({ revision: atRevision, seats }), BEA, ANN, declared)).toMatch(
            /Beast Tamer/
        )
        expect(refusal(table({ revision: before, seats }), BEA, ANN, declared)).toBeUndefined()
        for (const revision of REVISIONS) {
            expect(
                refusal(table(beaAway({ revision, seats })), DANA, ANN, declared),
                `revision ${revision}`
            ).toMatch(/Beast Tamer/)
        }
    })

    it('Ancient Bloodline as Ann’s adviser: Bea cannot target the relic at the Empire’s site with Relic Hunter', () => {
        const scene = {
            relicAtP1: true,
            seats: {
                [ANN]: { advisers: faceup([ANCIENT_BLOODLINE]) },
                [BEA]: { advisers: faceup([RELIC_HUNTER]) },
                [DANA]: { advisers: faceup([RELIC_HUNTER]) }
            }
        }
        const declared = {
            targets: [
                siteTarget('c1'),
                siteTarget('p1'),
                { kind: CampaignTargetKind.SiteRelic as const, slotId: 'p1-r1' }
            ],
            plans: [RELIC_HUNTER]
        }
        expect(refusal(table({ revision: atRevision, ...scene }), BEA, ANN, declared)).toMatch(
            /Ancient Bloodline/
        )
        expect(refusal(table({ revision: before, ...scene }), BEA, ANN, declared)).toBeUndefined()
        for (const revision of REVISIONS) {
            expect(
                refusal(table(beaAway({ revision, ...scene })), DANA, ANN, declared),
                `revision ${revision}`
            ).toMatch(/Ancient Bloodline/)
        }
    })

    it('the Narrow Pass the Empire rules: Bea attacking Ann from another region must target it', () => {
        const scene = {
            siteCards: { p1: NARROW_PASS },
            warbands: { p2: { [IMPERIAL_WARBANDS]: 1 } }
        }
        const pastThePass = { targets: [siteTarget('c1'), siteTarget('p2')] }
        const throughThePass = { targets: [siteTarget('c1'), siteTarget('p1')] }
        expect(refusal(table({ revision: atRevision, ...scene }), BEA, ANN, pastThePass)).toMatch(
            /Narrow Pass/
        )
        expect(
            refusal(table({ revision: before, ...scene }), BEA, ANN, pastThePass)
        ).toBeUndefined()
        for (const revision of REVISIONS) {
            expect(
                refusal(table({ revision, ...scene }), BEA, ANN, throughThePass),
                `revision ${revision}`
            ).toBeUndefined()
            expect(
                refusal(table(beaAway({ revision, ...scene })), DANA, ANN, pastThePass),
                `revision ${revision}`
            ).toMatch(/Narrow Pass/)
        }
    })
})

describe('an added cost held as an adviser is its holder’s, whatever the scope', () => {
    it("Insect Swarm, Bea's adviser: Bea's plan pays nothing more and Ann's defence plan burns a favor, at either revision", () => {
        for (const revision of REVISIONS) {
            const s = table({
                revision,
                seats: {
                    [BEA]: { advisers: faceup([INSECT_SWARM, HORSE_ARCHERS]) },
                    [ANN]: { advisers: faceup([BEAR_TRAPS]) }
                }
            })
            declare(s, BEA, against(ANN), { targets: [siteTarget('c1')], plans: [HORSE_ARCHERS] })
            expect(s.getPlayerState(BEA).favor, `revision ${revision}`).toBe(4)
            defend([battlePlanUse(BEAR_TRAPS)], ANN).apply(s)
            expect(ongoingCampaign(s).plansUsed).toEqual([HORSE_ARCHERS, BEAR_TRAPS])
            expect(s.getPlayerState(ANN).favor, `revision ${revision}`).toBe(3)
        }
    })
})

describe('R-5.5.1.a-H2 — the banish (R-5.5.7.III) is judged in the Campaign’s scope', () => {
    /** Ann defeats `defenderId`, targeting their pawn and favor; R-5.5.6's kills taken. */
    function defeated(scene: Scene, defenderId: string, defenderPlans: string[] = []) {
        const s = table(scene)
        declare(s, ANN, against(defenderId), { targets: [pawnAndFavor], attackDice: 0 })
        if (defenderPlans.length > 0) defend(defenderPlans.map(battlePlanUse), defenderId).apply(s)
        ongoingCampaign(s).swords = 9
        ongoingCampaign(s).defense = 0
        new HydratedCampaignSacrifice(
            buildAction(CampaignSacrifice, {
                playerId: ANN,
                sacrifice: 0,
                defeatKills: HydratedCampaignSacrifice.attackerDefeatKills(s, 0)
            })
        ).apply(s)
        defendingSideChooses(s)
        return s
    }

    const banishing = (siteId: string) =>
        new HydratedCampaignResolveVictory(
            buildAction(CampaignResolveVictory, {
                playerId: ANN,
                placements: [],
                burnFavor: false,
                banishToSiteId: siteId
            })
        )

    /** The defender's board before the banish and after it, and the History notes. */
    function banished(scene: Scene, defenderId: string, owner: string, toSiteId: string) {
        const s = defeated(scene, defenderId)
        const was = boardOf(s, defenderId, owner)
        const victory = banishing(toSiteId)
        victory.apply(s)
        return {
            s,
            lost: was - boardOf(s, defenderId, owner),
            notes: victory.metadata?.triggered ?? []
        }
    }

    const vines = {
        denizens: { c2: [GRASPING_VINES] },
        warbands: { c2: { [IMPERIAL_WARBANDS]: 2 } },
        seats: { [ANN]: { siteId: 'c2' }, [BEA]: { siteId: 'c2' }, [DANA]: { siteId: 'c2' } }
    }
    const lake = { denizens: { h1: [BOILING_LAKE] }, warbands: { h1: { [IMPERIAL_WARBANDS]: 1 } } }

    it('out of a Grasping Vines site the Empire rules, Bea loses a warband; before revision 14 they lost none', () => {
        const scoped = banished({ revision: atRevision, ...vines }, BEA, IMPERIAL_WARBANDS, 'h1')
        expect(scoped.lost).toBe(1)
        expect(scoped.notes).toContain(`Grasping Vines: killed a warband on ${BEA}'s board`)
        expect(banished({ revision: before, ...vines }, BEA, IMPERIAL_WARBANDS, 'h1').lost).toBe(0)
    })

    it('into a Boiling Lake the Empire rules, Bea loses two; before revision 14 they lost none', () => {
        const scoped = banished({ revision: atRevision, ...lake }, BEA, IMPERIAL_WARBANDS, 'h1')
        expect(scoped.lost).toBe(2)
        expect(scoped.notes).toContain(`Boiling Lake: killed 2 warbands on ${BEA}'s board`)
        expect(banished({ revision: before, ...lake }, BEA, IMPERIAL_WARBANDS, 'h1').lost).toBe(0)
    })

    it('control: Dana, an Exile, loses the same at either revision', () => {
        for (const revision of REVISIONS) {
            expect(
                banished({ revision, ...vines }, DANA, DANA, 'h1').lost,
                `revision ${revision}`
            ).toBe(1)
            expect(
                banished({ revision, ...lake }, DANA, DANA, 'h1').lost,
                `revision ${revision}`
            ).toBe(2)
        }
    })

    it('to a site the Empire rules with Toll Roads, Bea is asked the toll, payable to Ann (R-10.4); before revision 14 they were not', () => {
        const tolled = {
            denizens: { h1: [TOLL_ROADS] },
            warbands: { h1: { [IMPERIAL_WARBANDS]: 1 } }
        }
        const scoped = defeated({ revision: atRevision, ...tolled }, BEA)
        banishing('h1').apply(scoped)
        expect(scoped.pendingQuestions?.queue[0]).toMatchObject({
            kind: PowerQuestionKind.PayTravelToll,
            askedPlayerId: BEA,
            payeeId: ANN
        })
        expect(scoped.getPlayerState(BEA).siteId).toBe('c1')
        answerQuestion(scoped, BEA, { kind: PowerQuestionKind.PayTravelToll, pay: true })
        expect(scoped.getPlayerState(BEA).siteId).toBe('h1')
        expect(scoped.getPlayerState(ANN).favor).toBe(5)

        const recorded = defeated({ revision: before, ...tolled }, BEA)
        banishing('h1').apply(recorded)
        expect(recorded.pendingQuestions?.queue ?? []).toEqual([])
        expect(recorded.getPlayerState(BEA).siteId).toBe('h1')

        for (const revision of REVISIONS) {
            const exile = defeated({ revision, ...tolled }, DANA)
            banishing('h1').apply(exile)
            expect(exile.pendingQuestions?.queue[0], `revision ${revision}`).toMatchObject({
                kind: PowerQuestionKind.PayTravelToll,
                askedPlayerId: DANA,
                payeeId: ANN
            })
        }
    })

    it('Vow of Union does not hold Bea at a site only the Empire rules, so they can be banished; before revision 14 it held them', () => {
        const vow = { seats: { [BEA]: { advisers: faceup([VOW_OF_UNION]) } } }
        const scoped = defeated({ revision: atRevision, ...vow }, BEA)
        expect(boardOf(scoped, BEA, IMPERIAL_WARBANDS)).toBeGreaterThan(0)
        banishing('h1').apply(scoped)
        expect(scoped.getPlayerState(BEA).siteId).toBe('h1')

        const recorded = defeated({ revision: before, ...vow }, BEA)
        expect(() => banishing('h1').apply(recorded)).toThrow(/Vow of Union/)
    })

    it('out of a Shrouded Wood the Empire rules, its ruler Ann picks where Bea goes (R-11.7); before revision 14 Ann named the site', () => {
        const wood = { siteCards: { c1: SHROUDED_WOOD } }
        const scoped = defeated({ revision: atRevision, ...wood }, BEA)
        expect(() => banishing('h1').apply(scoped)).toThrow(/Shrouded Wood's ruler chooses/)
        new HydratedCampaignResolveVictory(
            buildAction(CampaignResolveVictory, {
                playerId: ANN,
                placements: [],
                burnFavor: false,
                banish: true
            })
        ).apply(scoped)
        expect(scoped.pendingQuestions?.queue[0]).toMatchObject({
            kind: PowerQuestionKind.ShroudedWoodDestination,
            askedPlayerId: ANN,
            travelerPlayerId: BEA
        })

        const recorded = defeated({ revision: before, ...wood }, BEA)
        banishing('h1').apply(recorded)
        expect(recorded.getPlayerState(BEA).siteId).toBe('h1')
    })

    it("Hospital: Dana's Hospital holds the Boiling Lake kill made on the banish, at either revision", () => {
        for (const revision of REVISIONS) {
            const s = defeated(
                {
                    revision,
                    ...lake,
                    denizens: { ...lake.denizens, p2: [HOSPITAL] },
                    warbands: { ...lake.warbands, p2: { [DANA]: 3 } }
                },
                DANA,
                [HOSPITAL]
            )
            const victory = banishing('h1')
            victory.apply(s)
            expect(victory.metadata?.triggered, `revision ${revision}`).toContain(
                `Boiling Lake: 2 warbands on ${DANA}'s board go to Hospital's site`
            )
            expect(s.campaign).toBeUndefined()
            expect(s.getPlayerState(DANA).warbandsInPersonalBank[DANA]).toBe(8)
        }
    })

    it('control: travel into the Boiling Lake outside a Campaign kills none of Bea’s, who rules it, at either revision', () => {
        for (const revision of REVISIONS) {
            const s = table({ revision, ...lake })
            openTurn(s, BEA)
            new HydratedTravel(buildAction(Travel, { playerId: BEA, siteId: 'h1' })).apply(s)
            expect(s.getPlayerState(BEA).siteId).toBe('h1')
            expect(boardOf(s, BEA, IMPERIAL_WARBANDS), `revision ${revision}`).toBe(6)
        }
    })

    it('control: Herald, an adviser, asks its holder after the Campaign, its scope gone', () => {
        const s = table({ revision: atRevision, seats: { [RHYS]: { advisers: faceup([HERALD]) } } })
        declare(s, BEA, against(ANN), { targets: [siteTarget('c1')], attackDice: 0 })
        new HydratedCampaignSacrifice(
            buildAction(CampaignSacrifice, {
                playerId: BEA,
                sacrifice: 0,
                defeatKills: HydratedCampaignSacrifice.attackerDefeatKills(s, 0)
            })
        ).apply(s)
        defendingSideChooses(s)
        if (s.campaign)
            new HydratedCampaignResolveVictory(
                buildAction(CampaignResolveVictory, {
                    playerId: BEA,
                    placements: [],
                    burnFavor: false
                })
            ).apply(s)
        expect(s.campaign).toBeUndefined()
        expect(s.pendingQuestions?.queue.map((q) => [q.kind, q.askedPlayerId])).toContainEqual([
            PowerQuestionKind.PickFavorBank,
            RHYS
        ])
    })
})

describe("the scope's checks on Bea's own view", () => {
    const bea: Visibility.Perspective = { kind: 'player', playerId: BEA }
    /** Bea's view as their table judges on it: projected, then guarded. */
    const ownView = (s: HydratedOathGameState) =>
        OathVisibility.state.guardForExecution(new HydratedOathGameState(served(s, bea)), bea)

    /** The same answer on the server and on Bea's view, and neither changes the state or what they are served. */
    function sameOnOwnView(
        s: HydratedOathGameState,
        check: (state: HydratedOathGameState) => string | undefined,
        expected: RegExp
    ) {
        const server = JSON.stringify(s.dehydrate())
        const seen = JSON.stringify(served(s, bea))
        expect(check(s)).toMatch(expected)
        expect(check(ownView(s))).toMatch(expected)
        expect(JSON.stringify(s.dehydrate())).toBe(server)
        expect(JSON.stringify(served(s, bea))).toBe(seen)
    }

    const targetsRefusal = (targets: CampaignTarget[]) => (state: HydratedOathGameState) =>
        reasonCannotDeclareTargets(
            state,
            HydratedCampaign.partiesFor(state, BEA, { defender: against(ANN), targets })
        )

    it('the targets refusals: Tome Guardians and Lost Tongue', () => {
        const guarded = table({
            revision: atRevision,
            atEmpireSite: [TOME_GUARDIANS],
            banners: { [Banner.DarkestSecret]: ANN }
        })
        openTurn(guarded, BEA)
        sameOnOwnView(
            guarded,
            targetsRefusal([siteTarget('c1'), banner(Banner.DarkestSecret)]),
            /Tome Guardians/
        )

        const tongue = table({
            revision: atRevision,
            atEmpireSite: [TENTS],
            banners: { [Banner.PeoplesFavor]: ANN },
            seats: {
                [ANN]: {
                    advisers: [
                        { cardId: 'denizen.hearth.storyteller', faceUp: false },
                        ...faceup([LOST_TONGUE])
                    ]
                }
            }
        })
        openTurn(tongue, BEA)
        sameOnOwnView(
            tongue,
            targetsRefusal([siteTarget('c1'), banner(Banner.PeoplesFavor)]),
            /Lost Tongue/
        )
    })

    it('the declaration refusals: the Narrow Pass, the Hidden Place flip, Spell Breaker and Beast Tamer', () => {
        const cases: Array<[Scene, Declaration, RegExp]> = [
            [
                {
                    revision: atRevision,
                    siteCards: { p1: NARROW_PASS },
                    warbands: { p2: { [IMPERIAL_WARBANDS]: 1 } }
                },
                { targets: [siteTarget('c1'), siteTarget('p2')] },
                /Narrow Pass/
            ],
            [
                {
                    revision: atRevision,
                    atEmpireSite: [SPELL_BREAKER],
                    siteCards: { c2: HIDDEN_PLACE },
                    warbands: { c2: { [IMPERIAL_WARBANDS]: 1 } }
                },
                { targets: [siteTarget('c1'), siteTarget('c2')], flipSecret: true },
                /Spell Breaker/
            ],
            [
                {
                    revision: atRevision,
                    atEmpireSite: [SPELL_BREAKER],
                    seats: { [BEA]: { advisers: faceup([KINDRED_WARRIORS]) } }
                },
                { targets: [siteTarget('c1')], plans: [KINDRED_WARRIORS] },
                /Spell Breaker/
            ],
            [
                {
                    revision: atRevision,
                    seats: {
                        [BEA]: { advisers: faceup([HORSE_ARCHERS]) },
                        [ANN]: {
                            advisers: [
                                { cardId: 'denizen.hearth.storyteller', faceUp: false },
                                ...faceup([BEAST_TAMER])
                            ]
                        }
                    }
                },
                { targets: [siteTarget('c1')], plans: [HORSE_ARCHERS] },
                /Beast Tamer/
            ]
        ]
        for (const [scene, declared, expected] of cases) {
            const s = table(scene)
            openTurn(s, BEA)
            sameOnOwnView(
                s,
                (state) =>
                    HydratedCampaign.reasonCannotCampaign(state, BEA, {
                        defender: against(ANN),
                        targets: declared.targets,
                        attackDice: 3,
                        plans: (declared.plans ?? []).map(battlePlanUse),
                        flipSecret: declared.flipSecret
                    }),
                expected
            )
        }
    })

    it("the defence refusal: Spell Breaker on Bea's plan that costs a secret", () => {
        const s = table({
            revision: atRevision,
            atEmpireSite: [SPELL_BREAKER],
            seats: { [BEA]: { advisers: faceup([KINDRED_WARRIORS, BEAR_TRAPS]) } }
        })
        declare(s, ANN, against(BEA), { targets: [pawnAndFavor] })
        sameOnOwnView(
            s,
            (state) =>
                HydratedCampaignDefend.reasonCannotDefend(state, BEA, [
                    battlePlanUse(KINDRED_WARRIORS)
                ]),
            /Spell Breaker/
        )
    })
})
