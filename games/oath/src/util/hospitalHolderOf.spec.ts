import { describe, expect, it } from 'vitest'
import { Color, type Visibility } from '@tabletop/common'
import * as entry from '../index.js'
import { BattlePlanSide } from '../data/cardPowers.js'
import { MachineState } from '../definition/states.js'
import { CampaignTargetKind, type WarbandGroup } from '../model/campaign.js'
import { HydratedOathGameState } from '../model/gameState.js'
import { PlayerStatus } from '../model/oathEnums.js'
import { IMPERIAL_WARBANDS } from '../model/warbandCounts.js'
import { campaignRecords, testPlayer, testState } from '../testing/fixture.js'
import { served, spectator } from '../testing/projection.js'
import { required } from '../testing/required.js'
import { hospitalHolderOf } from './campaignRoll.js'

/**
 * R-5.5.6.a — an Exile beat the Chancellor at c1; the defending force is the Empire's warbands at c1,
 * on the Chancellor's board and on a Citizen ally's board; the Chancellor used Hospital, at p1.
 */
function defeatedWithHospital(): HydratedOathGameState {
    const force: WarbandGroup[] = [
        { at: { kind: 'site', siteId: 'c1' }, owner: IMPERIAL_WARBANDS, count: 2 },
        { at: { kind: 'board', playerId: 'chan' }, owner: IMPERIAL_WARBANDS, count: 2 },
        { at: { kind: 'board', playerId: 'cit' }, owner: IMPERIAL_WARBANDS, count: 2 }
    ]
    return testState(
        [
            testPlayer({
                playerId: 'att',
                color: Color.Red,
                siteId: 'c1',
                warbandsOnBoard: { att: 4 },
                warbandsInPersonalBank: { att: 10 }
            }),
            testPlayer({
                playerId: 'chan',
                color: Color.Purple,
                status: PlayerStatus.Chancellor,
                siteId: 'c1',
                warbandsOnBoard: { [IMPERIAL_WARBANDS]: 2 },
                warbandsInPersonalBank: { [IMPERIAL_WARBANDS]: 12 },
                advisers: [{ cardId: 'denizen.nomad.tents', faceUp: false }]
            }),
            testPlayer({
                playerId: 'cit',
                color: Color.Blue,
                status: PlayerStatus.Citizen,
                siteId: 'c1',
                warbandsOnBoard: { [IMPERIAL_WARBANDS]: 2 },
                warbandsInPersonalBank: { cit: 14 }
            })
        ],
        {
            machineState: MachineState.CampaignDefeat,
            chancellorPlayerId: 'chan',
            denizensBySite: { c1: [], c2: [], p1: ['denizen.hearth.hospital'], h1: [] },
            warbandsBySite: { c1: { [IMPERIAL_WARBANDS]: 2 }, p1: { [IMPERIAL_WARBANDS]: 1 } },
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
                defense: 7,
                swords: 8,
                defendingForce: force,
                defendingBandits: 0,
                attackerVictorious: true,
                pendingDefeatKills: { chooserPlayerId: 'chan' },
                ...campaignRecords(),
                plansUsed: ['denizen.hearth.hospital'],
                plansUsedBy: { chan: ['denizen.hearth.hospital'] },
                killRedirects: [{ playerId: 'chan', siteId: 'p1' }]
            }
        }
    )
}

function holders(state: HydratedOathGameState): (string | undefined)[] {
    const campaign = required(state.campaign, 'the Campaign')
    return campaign.defendingForce.map((group) =>
        hospitalHolderOf(state, campaign, BattlePlanSide.Defender, group)
    )
}

describe('hospitalHolderOf, read by a seat', () => {
    it('is exported from the package entry, for a client to name whose Hospital holds a loss', () => {
        expect(entry.hospitalHolderOf).toBe(hospitalHolderOf)
    })

    it("names the Hospital's user for their site's and board's warbands, and no one for an ally's board", () => {
        expect(holders(defeatedWithHospital())).toEqual(['chan', 'chan', undefined])
    })

    it("a seat's served view names the same holders as the server's state, and the state is unchanged", () => {
        const state = defeatedWithHospital()
        const before = JSON.stringify(state.dehydrate())
        const views: Visibility.Perspective[] = [
            spectator,
            ...['att', 'chan', 'cit'].map((playerId) => ({ kind: 'player' as const, playerId }))
        ]
        for (const view of views) {
            expect(holders(new HydratedOathGameState(served(state, view)))).toEqual(holders(state))
        }
        expect(JSON.stringify(state.dehydrate())).toBe(before)
    })
})
