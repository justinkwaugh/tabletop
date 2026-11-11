import { describe, expect, it } from 'vitest'
import { Color, type Visibility } from '@tabletop/common'
import * as entry from '../index.js'
import { MachineState } from '../definition/states.js'
import { CampaignTargetKind, type CampaignState, type WarbandGroup } from '../model/campaign.js'
import { HydratedOathGameState } from '../model/gameState.js'
import { PlayerStatus } from '../model/oathEnums.js'
import { IMPERIAL_WARBANDS } from '../model/warbandCounts.js'
import { campaignRecords, testPlayer, testState } from '../testing/fixture.js'
import { served, spectator } from '../testing/projection.js'
import { required } from '../testing/required.js'
import { decidingPlans } from './battleOutcome.js'

const HEARTS_AND_MINDS = 'denizen.hearth.hearts-and-minds'
const PEACE_ENVOY = 'denizen.order.peace-envoy'
const OBSIDIAN_CAGE = 'relic.obsidian-cage'
const ZEALOTS = 'denizen.discord.zealots'
const HOSPITAL = 'denizen.hearth.hospital'

/**
 * R-5.5 — an Exile ('att') campaigns against the Chancellor ('chan') at c1, a Citizen ('cit') their
 * ally; the defending force is the Empire's warbands at c1 and on the Chancellor's board. `record`
 * is what the Campaign's running record holds of the plans used and the outcome.
 */
function campaignWith(record: Partial<CampaignState>): HydratedOathGameState {
    const force: WarbandGroup[] = [
        { at: { kind: 'site', siteId: 'c1' }, owner: IMPERIAL_WARBANDS, count: 3 },
        { at: { kind: 'board', playerId: 'chan' }, owner: IMPERIAL_WARBANDS, count: 3 }
    ]
    return testState(
        [
            testPlayer({
                playerId: 'att',
                color: Color.Red,
                siteId: 'c1',
                warbandsOnBoard: { att: 4 },
                warbandsInPersonalBank: { att: 10 },
                advisers: [{ cardId: 'denizen.nomad.tents', faceUp: false }]
            }),
            testPlayer({
                playerId: 'chan',
                color: Color.Purple,
                status: PlayerStatus.Chancellor,
                siteId: 'c1',
                favor: 2,
                warbandsOnBoard: { [IMPERIAL_WARBANDS]: 3 },
                warbandsInPersonalBank: { [IMPERIAL_WARBANDS]: 10 },
                advisers: [{ cardId: 'denizen.nomad.tents', faceUp: false }]
            }),
            testPlayer({
                playerId: 'cit',
                color: Color.Blue,
                status: PlayerStatus.Citizen,
                siteId: 'c1',
                warbandsOnBoard: { cit: 2 },
                warbandsInPersonalBank: { cit: 12 }
            })
        ],
        {
            machineState: MachineState.CampaignSacrifice,
            chancellorPlayerId: 'chan',
            warbandsBySite: { c1: { [IMPERIAL_WARBANDS]: 3 } },
            campaign: {
                attackerPlayerId: 'att',
                defenderPlayerId: 'chan',
                nonImperialPlayerIds: [],
                allyPlayerIds: ['cit'],
                targets: [{ kind: CampaignTargetKind.Site, siteId: 'c1' }],
                attackPool: 4,
                defensePool: 1,
                attackRoll: [],
                defenseRoll: [],
                defense: 0,
                swords: 0,
                defendingForce: force,
                defendingBandits: 0,
                ...campaignRecords(),
                ...record
            }
        }
    )
}

function decided(state: HydratedOathGameState) {
    return decidingPlans(state, required(state.campaign, 'the Campaign'))
}

describe('decidingPlans, the cards a Campaign record says settled it', () => {
    it('is exported from the package entry, for a client to name the card that decided a battle', () => {
        expect(entry.decidingPlans).toBe(decidingPlans)
    })

    it('names Hearts and Minds when the defender used it and the battle is decided for them', () => {
        const state = campaignWith({
            plansUsed: [ZEALOTS, HOSPITAL, HEARTS_AND_MINDS],
            plansUsedBy: { att: [ZEALOTS], chan: [HOSPITAL, HEARTS_AND_MINDS] },
            decidedVictor: 'defender'
        })
        expect(decided(state)).toEqual({ victory: HEARTS_AND_MINDS })
    })

    it("names the attacker's Peace Envoy when the battle is decided for the attacker", () => {
        const state = campaignWith({
            plansUsed: [PEACE_ENVOY],
            plansUsedBy: { att: [PEACE_ENVOY] },
            decidedVictor: 'attacker',
            ignoreDefeatKills: true
        })
        expect(decided(state)).toEqual({ victory: PEACE_ENVOY })
    })

    it("names the first decision only, the one the engine keeps: the attacker's, not a later defender's", () => {
        const state = campaignWith({
            plansUsed: [PEACE_ENVOY, HEARTS_AND_MINDS],
            plansUsedBy: { att: [PEACE_ENVOY], chan: [HEARTS_AND_MINDS] },
            decidedVictor: 'attacker'
        })
        expect(decided(state)).toEqual({ victory: PEACE_ENVOY })
    })

    it("names an ally's Peace Envoy when the defending side's decision is the ally's", () => {
        const state = campaignWith({
            plansUsed: [ZEALOTS, PEACE_ENVOY],
            plansUsedBy: { att: [ZEALOTS], cit: [PEACE_ENVOY] },
            decidedVictor: 'defender'
        })
        expect(decided(state)).toEqual({ victory: PEACE_ENVOY })
    })

    it('names nothing for a battle the dice decide', () => {
        const state = campaignWith({
            plansUsed: [ZEALOTS, HOSPITAL],
            plansUsedBy: { att: [ZEALOTS], chan: [HOSPITAL] }
        })
        expect(decided(state)).toEqual({})
    })

    it('names the Obsidian Cage when the victorious attacker used it, and not when the attacker lost', () => {
        const record = { plansUsed: [OBSIDIAN_CAGE], plansUsedBy: { att: [OBSIDIAN_CAGE] } }
        expect(decided(campaignWith({ ...record, attackerVictorious: true }))).toEqual({
            survivors: OBSIDIAN_CAGE
        })
        expect(decided(campaignWith({ ...record, attackerVictorious: false }))).toEqual({})
        expect(decided(campaignWith(record))).toEqual({})
    })

    it("a seat's served view names the same cards as the server's state, and the state is unchanged", () => {
        const state = campaignWith({
            plansUsed: [OBSIDIAN_CAGE, HEARTS_AND_MINDS],
            plansUsedBy: { att: [OBSIDIAN_CAGE], chan: [HEARTS_AND_MINDS] },
            decidedVictor: 'defender',
            attackerVictorious: false
        })
        const before = JSON.stringify(state.dehydrate())
        const views: Visibility.Perspective[] = [
            spectator,
            ...['att', 'chan', 'cit'].map((playerId) => ({ kind: 'player' as const, playerId }))
        ]
        for (const view of views) {
            expect(decided(new HydratedOathGameState(served(state, view)))).toEqual(decided(state))
        }
        expect(decided(state)).toEqual({ victory: HEARTS_AND_MINDS })
        expect(JSON.stringify(state.dehydrate())).toBe(before)
    })
})
