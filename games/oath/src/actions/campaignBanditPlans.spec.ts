import { describe, expect, it } from 'vitest'
import { Color } from '@tabletop/common'
import { Campaign, HydratedCampaign } from './campaign.js'
import { CampaignSacrifice, HydratedCampaignSacrifice } from './campaignSacrifice.js'
import {
    CampaignResolveVictory,
    HydratedCampaignResolveVictory
} from './campaignResolveVictory.js'
import { HydratedOathGameState } from '../model/gameState.js'
import { PlayerStatus } from '../model/oathEnums.js'
import type { OathPlayerState } from '../model/playerState.js'
import { IMPERIAL_WARBANDS, type WarbandCounts } from '../model/warbandCounts.js'
import { CURRENT_OATH_REVISION, OathRevision } from '../util/revision.js'
import { CRADLE, HINTERLAND, PROVINCES, openTurn, testPlayer, testState } from '../testing/fixture.js'
import { buildAction } from '../testing/actions.js'
import { battlePlanUse, siteTarget } from '../testing/choices.js'
import { ongoingCampaign } from '../testing/required.js'
import '../powers/index.js'

const TRUE_NAMES = 'denizen.beast.true-names'
const BEAST_TAMER = 'denizen.discord.beast-tamer'
const GLEAMING_ARMOR = 'denizen.arcane.gleaming-armor'
const INSECT_SWARM = 'denizen.beast.insect-swarm'
const VOW_OF_RENEWAL = 'denizen.discord.vow-of-renewal'
/** Order, defender, free: −1 attack die, and a warband on the attacker's board killed. */
const BEAR_TRAPS = 'denizen.order.bear-traps'
/** Nomad, defender, free: +2 defense dice; discarded at the end. */
const STORM_CALLER = 'denizen.nomad.storm-caller'
/** Order, either side, free: ±1 attack die. */
const LONGBOWS = 'denizen.order.longbows'
const CODE_OF_HONOR = 'denizen.order.code-of-honor'
const SPECIALIST = 'denizen.order.specialist'
const HOSPITAL = 'denizen.hearth.hospital'
/** An order adviser, an attacker's plan the bandits never rule. */
const SCOUTS = 'denizen.order.scouts'
/** A nomad adviser. */
const HORSE_ARCHERS = 'denizen.nomad.horse-archers'

const DANA = 'dana' // an Exile
const ANN = 'ann' // the Chancellor

const atRevision = CURRENT_OATH_REVISION
const before = OathRevision.EngineFixes9

const FIXTURE_SITES = [...CRADLE, ...PROVINCES, ...HINTERLAND]

interface Scene {
    revision: number
    /** The cards at c1, a site no player's warbands hold, so the bandits rule it. */
    atBanditSite?: string[]
    denizens?: Record<string, string[]>
    warbands?: Record<string, WarbandCounts>
    siteCards?: Record<string, string>
    dana?: Partial<OathPlayerState>
    ann?: Partial<OathPlayerState>
}

const faceup = (cardIds: string[]) => cardIds.map((cardId) => ({ cardId, faceUp: true }))

/** Dana, an Exile, at c1; Ann, the Chancellor, away at h3. The Empire holds c2; the bandits every other site. */
function table(scene: Scene): HydratedOathGameState {
    return testState(
        [
            testPlayer({ playerId: DANA, color: Color.Red, status: PlayerStatus.Exile, siteId: 'c1', supply: 6, favor: 4, secrets: 3, warbandsOnBoard: { [DANA]: 6 }, warbandsInPersonalBank: { [DANA]: 4 }, ...scene.dana }),
            testPlayer({ playerId: ANN, color: Color.Purple, status: PlayerStatus.Chancellor, siteId: 'h3', supply: 6, favor: 4, secrets: 3, warbandsOnBoard: { [IMPERIAL_WARBANDS]: 6 }, warbandsInPersonalBank: { [IMPERIAL_WARBANDS]: 8 }, ...scene.ann })
        ],
        {
            oathRevision: scene.revision,
            denizensBySite: { c1: scene.atBanditSite ?? [], c2: [], p1: [], p2: [], h1: [], ...scene.denizens },
            warbandsBySite: { c2: { [IMPERIAL_WARBANDS]: 1 }, ...scene.warbands },
            siteCards: { ...Object.fromEntries(FIXTURE_SITES.map((slotId) => [slotId, slotId])), ...scene.siteCards },
            prng: { seed: 1, invocations: 0 }
        }
    )
}

/** The Campaign against the bandits at c1, with four attack dice unless said; the plans the bandits used. */
function attackBandits(s: HydratedOathGameState, attackerId = DANA, plans: string[] = [], attackDice = 4): string[] {
    openTurn(s, attackerId)
    const campaign = new HydratedCampaign(
        buildAction(Campaign, { playerId: attackerId, defender: { kind: 'bandits' }, targets: [siteTarget('c1')], attackDice, plans: plans.map(battlePlanUse) })
    )
    campaign.apply(s)
    return ongoingCampaign(s).plansUsedBy.bandits ?? []
}

const pools = (s: HydratedOathGameState) => {
    const campaign = ongoingCampaign(s)
    return { attack: campaign.attackPool, defense: campaign.defensePool }
}
const boardOf = (s: HydratedOathGameState, playerId: string) => s.getPlayerState(playerId).warbandsOnBoard[playerId] ?? 0

describe("R-5.5.3-H4 — the bandits' compelled plans pass the bans a player's do (R-9.2)", () => {
    it('control: with no such card the bandits use Bear Traps and Storm Caller, at either revision', () => {
        for (const revision of [atRevision, before]) {
            expect(attackBandits(table({ revision, atBanditSite: [BEAR_TRAPS, STORM_CALLER] })), `revision ${revision}`).toEqual([BEAR_TRAPS, STORM_CALLER])
        }
    })

    it('True Names with an order adviser: the bandits do not use Bear Traps, and the pools and the board are as with no plan', () => {
        const dana = { advisers: faceup([TRUE_NAMES, SCOUTS]) }
        const banned = table({ revision: atRevision, atBanditSite: [BEAR_TRAPS], dana })
        expect(attackBandits(banned)).toEqual([])
        const none = table({ revision: atRevision, dana })
        attackBandits(none)
        expect(pools(banned)).toEqual(pools(none))
        expect(boardOf(banned, DANA)).toBe(boardOf(none, DANA))
        expect(ongoingCampaign(banned).plansUsed).toEqual([])

        // With no attack dice no skull kills, so the board shows Bear Traps' kill alone.
        const unrolled = table({ revision: atRevision, atBanditSite: [BEAR_TRAPS], dana })
        expect(attackBandits(unrolled, DANA, [], 0)).toEqual([])
        expect(boardOf(unrolled, DANA)).toBe(6)

        const recorded = table({ revision: before, atBanditSite: [BEAR_TRAPS], dana })
        expect(attackBandits(recorded, DANA, [], 0)).toEqual([BEAR_TRAPS])
        expect(boardOf(recorded, DANA)).toBe(5)
    })

    it('control: True Names with no adviser of the plan’s suit leaves Bear Traps to the bandits', () => {
        const s = table({ revision: atRevision, atBanditSite: [BEAR_TRAPS], dana: { advisers: faceup([TRUE_NAMES, HORSE_ARCHERS]) } })
        expect(attackBandits(s)).toEqual([BEAR_TRAPS])
    })

    it('Beast Tamer: the bandits do not use the nomad Storm Caller; before revision 14 they did', () => {
        const dana = { advisers: faceup([BEAST_TAMER]) }
        expect(attackBandits(table({ revision: atRevision, atBanditSite: [STORM_CALLER], dana }))).toEqual([])
        expect(attackBandits(table({ revision: before, atBanditSite: [STORM_CALLER], dana }))).toEqual([STORM_CALLER])
    })

    it('Beast Tamer held by Ann, the Chancellor: the bandits are their enemy without a player to look up, and Storm Caller is not used', () => {
        const ann = { siteId: 'c1', advisers: faceup([BEAST_TAMER]) }
        expect(attackBandits(table({ revision: atRevision, atBanditSite: [STORM_CALLER], ann }), ANN)).toEqual([])
        expect(attackBandits(table({ revision: before, atBanditSite: [STORM_CALLER], ann }), ANN)).toEqual([STORM_CALLER])
    })

    it("Code of Honor banned by True Names does not shut out the bandits' other plans; not banned, it stands alone", () => {
        const dana = { advisers: faceup([TRUE_NAMES, SCOUTS]) }
        expect(attackBandits(table({ revision: atRevision, atBanditSite: [CODE_OF_HONOR, STORM_CALLER], dana }))).toEqual([STORM_CALLER])
        expect(attackBandits(table({ revision: before, atBanditSite: [CODE_OF_HONOR, STORM_CALLER], dana }))).toEqual([CODE_OF_HONOR])
        expect(attackBandits(table({ revision: atRevision, atBanditSite: [CODE_OF_HONOR, STORM_CALLER] }))).toEqual([CODE_OF_HONOR])
    })

    it('control: Specialist leaves the bandits no plan, at either revision', () => {
        for (const revision of [atRevision, before]) {
            const s = table({ revision, atBanditSite: [BEAR_TRAPS], dana: { advisers: faceup([SPECIALIST]) } })
            expect(attackBandits(s, DANA, [SPECIALIST]), `revision ${revision}`).toEqual([])
            expect(ongoingCampaign(s).plansUsed).toEqual([SPECIALIST])
        }
    })
})

describe("R-5.5.3-H4 — an enemy's added cost leaves the bandits' plan with a cost (R-5.5.3, R-10.3-H1)", () => {
    for (const card of [GLEAMING_ARMOR, INSECT_SWARM]) {
        it(`${card}: the bandits do not use Bear Traps, and nothing is burned or placed; before revision 14 they did`, () => {
            const dana = { advisers: faceup([card]) }
            const s = table({ revision: atRevision, atBanditSite: [BEAR_TRAPS], dana })
            const supply = s.favorSupply
            expect(attackBandits(s)).toEqual([])
            expect(s.getPlayerState(DANA).favor).toBe(4)
            expect(s.getPlayerState(DANA).secrets).toBe(3)
            expect(s.favorSupply).toBe(supply)
            expect(s.cardTokens[BEAR_TRAPS]).toBeUndefined()

            expect(attackBandits(table({ revision: before, atBanditSite: [BEAR_TRAPS], dana }))).toEqual([BEAR_TRAPS])
        })
    }

    it("Vow of Renewal: no favor of a dropped plan's added cost comes to its holder", () => {
        const s = table({ revision: atRevision, atBanditSite: [BEAR_TRAPS], dana: { advisers: faceup([INSECT_SWARM]) }, ann: { advisers: faceup([VOW_OF_RENEWAL]) } })
        expect(attackBandits(s)).toEqual([])
        expect(s.getPlayerState(ANN).favor).toBe(4)
    })
})

describe("the bandits' dropped plans beside the Campaign's other steps", () => {
    it("Hospital: Bear Traps banned by True Names kills nothing for Dana's Hospital to hold", () => {
        // No attack dice, so no skull kills for Hospital to hold either.
        const scene = { atBanditSite: [BEAR_TRAPS], denizens: { p2: [HOSPITAL] }, warbands: { p2: { [DANA]: 2 } }, dana: { advisers: faceup([TRUE_NAMES, SCOUTS]) } }
        const s = table({ revision: atRevision, ...scene })
        expect(attackBandits(s, DANA, [HOSPITAL], 0)).toEqual([])
        expect(ongoingCampaign(s).heldForHospital).toBeUndefined()
        expect(boardOf(s, DANA)).toBe(6)

        const recorded = table({ revision: before, ...scene })
        expect(attackBandits(recorded, DANA, [HOSPITAL], 0)).toEqual([BEAR_TRAPS])
        expect(ongoingCampaign(recorded).heldForHospital?.map((held) => held.count)).toEqual([1])
    })

    it("the site dice: a banned Longbows at the Mountain leaves the pools as Step 2 left them (R-11.4-H1)", () => {
        const scene = { siteCards: { c1: 'site.mountain' }, dana: { advisers: faceup([TRUE_NAMES, SCOUTS]) } }
        const banned = table({ revision: atRevision, atBanditSite: [LONGBOWS], ...scene })
        expect(attackBandits(banned)).toEqual([])
        const none = table({ revision: atRevision, ...scene })
        attackBandits(none)
        expect(pools(banned)).toEqual(pools(none))

        const recorded = table({ revision: before, atBanditSite: [LONGBOWS], ...scene })
        expect(attackBandits(recorded)).toEqual([LONGBOWS])
        expect(pools(recorded)).not.toEqual(pools(none))
    })

    it('R-5.5.8: a dropped Storm Caller is not discarded at the end; one used is', () => {
        function concluded(revision: number) {
            const s = table({ revision, atBanditSite: [STORM_CALLER], dana: { advisers: faceup([BEAST_TAMER]) } })
            attackBandits(s)
            ongoingCampaign(s).swords = 9
            ongoingCampaign(s).defense = 0
            new HydratedCampaignSacrifice(
                buildAction(CampaignSacrifice, { playerId: DANA, sacrifice: 0, defeatKills: HydratedCampaignSacrifice.attackerDefeatKills(s, 0) })
            ).apply(s)
            if (s.campaign) new HydratedCampaignResolveVictory(buildAction(CampaignResolveVictory, { playerId: DANA, placements: [], burnFavor: false })).apply(s)
            expect(s.campaign).toBeUndefined()
            return s
        }
        expect(concluded(atRevision).denizensBySite.c1).toEqual([STORM_CALLER])
        expect(concluded(before).denizensBySite.c1).toEqual([])
    })
})
