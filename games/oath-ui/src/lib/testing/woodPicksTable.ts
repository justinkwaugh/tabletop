import { ActionSource, createAction } from '@tabletop/common'
import {
    CampaignResolveVictory,
    CampaignTargetKind,
    MachineState,
    PowerChoiceKind,
    PowerTiming,
    Region,
    UseActionPower,
    powerIndexOf,
    type HydratedOathGameState
} from '@tabletop/oath'
import { campaignRecords, openTurn, testVaultWithDiscards } from '@tabletop/oath/testing'
import { played, tableOf, type PlayedTable } from './sessionHarness.js'
import { WOOD_SLOTS, woodCardsState } from './woodCardsTable.js'

export const WHISTLE = 'relic.whistle'
export const BRASS_HORSE = 'relic.brass-horse'
export const PALANQUIN = 'denizen.order.palanquin'
export const TOLL_ROADS = 'denizen.order.toll-roads'

const { wood, greatSlum, river, mountain, wastes } = WOOD_SLOTS

/**
 * The Travel picks made on the map after a card or a banish moves a pawn, on the Shrouded Wood
 * tables' map (Bea, an Exile, rules the Wood; Ann is the Chancellor; Dana an Exile):
 * - `whistle`: Ann, at the River, uses the Whistle on Dana, at Bea's Wood; Bea picks, any site.
 * - `whistleAway`: the same, with Ann at the Wastes, in another region than Dana's.
 * - `whistleToll`: the same as `whistle`, with Toll Roads at the Great Slum, which the Empire rules.
 * - `horseWood`: Dana, at Bea's Wood, uses the Brass Horse and reveals Council Seat (an Order
 *   card); Bea picks among the Order sites, the River and the Mountain.
 * - `palanquin`: Ann, at Bea's Wood with Dana, uses Palanquin to put their pawn on the River; Bea
 *   picks where Dana travels.
 * - `banish`: Ann won a Campaign at Bea's Wood against Dana and banishes them; Bea picks.
 * - `horseOwn`: Dana, at the River with 2 faceup secrets, uses the Brass Horse and reveals Giant
 *   Python (a Beast card): Dana picks the Plains or The Hidden Place, which flips their last one.
 */
export type WoodPickScene =
    'whistle' | 'whistleAway' | 'whistleToll' | 'horseWood' | 'palanquin' | 'banish' | 'horseOwn'

function sceneState(scene: WoodPickScene): HydratedOathGameState {
    const state = woodCardsState({ advisers: [] })
    const dana = state.getPlayerState('Dana')
    const ann = state.getPlayerState('Ann')
    switch (scene) {
        case 'whistle':
        case 'whistleAway':
        case 'whistleToll':
            ann.relicIds = [WHISTLE]
            ann.secrets = 1
            if (scene === 'whistleAway') ann.siteId = wastes
            if (scene === 'whistleToll') {
                state.denizensBySite = {
                    ...state.denizensBySite,
                    [greatSlum]: [...(state.denizensBySite[greatSlum] ?? []), TOLL_ROADS]
                }
            }
            openTurn(state, 'Ann')
            state.activePlayerIds = ['Ann']
            return state
        case 'horseWood':
        case 'horseOwn': {
            const top =
                scene === 'horseWood' ? 'denizen.order.council-seat' : 'denizen.beast.giant-python'
            dana.relicIds = [BRASS_HORSE]
            dana.secrets = 2
            if (scene === 'horseOwn') {
                dana.siteId = river
                ann.siteId = greatSlum
            }
            state.vault = testVaultWithDiscards({ [Region.Provinces]: [top] })
            state.discardPileCounts = { ...state.discardPileCounts, [Region.Provinces]: 1 }
            return state
        }
        case 'palanquin':
            ann.siteId = wood
            ann.favor = 2
            ann.advisers = [{ cardId: PALANQUIN, faceUp: true }]
            openTurn(state, 'Ann')
            state.activePlayerIds = ['Ann']
            return state
        case 'banish':
            ann.siteId = wood
            state.machineState = MachineState.CampaignVictory
            state.campaign = {
                attackerPlayerId: 'Ann',
                defenderPlayerId: 'Dana',
                nonImperialPlayerIds: [],
                allyPlayerIds: [],
                targets: [{ kind: CampaignTargetKind.PawnAndFavor }],
                attackPool: 4,
                defensePool: 1,
                attackRoll: [],
                defenseRoll: [],
                defense: 1,
                swords: 4,
                defendingForce: [],
                defendingBandits: 0,
                ...campaignRecords(),
                attackerVictorious: true
            }
            openTurn(state, 'Ann')
            state.activePlayerIds = ['Ann']
            return state
    }
}

/** The scene's table once the card or the banish has asked its pick. */
export function woodPickTable(scene: WoodPickScene): PlayedTable {
    const table = tableOf(sceneState(scene))
    const envelope = { gameId: table.state.gameId, source: ActionSource.User }
    switch (scene) {
        case 'whistle':
        case 'whistleAway':
        case 'whistleToll':
            return played(table, [
                createAction(UseActionPower, {
                    ...envelope,
                    playerId: 'Ann',
                    cardId: WHISTLE,
                    powerIndex: powerIndexOf(WHISTLE, PowerTiming.Action),
                    choices: [{ kind: PowerChoiceKind.Player, playerId: 'Dana' }]
                })
            ])
        case 'horseWood':
        case 'horseOwn':
            return played(table, [
                createAction(UseActionPower, {
                    ...envelope,
                    playerId: 'Dana',
                    cardId: BRASS_HORSE,
                    powerIndex: powerIndexOf(BRASS_HORSE, PowerTiming.Action),
                    choices: []
                })
            ])
        case 'palanquin':
            return played(table, [
                createAction(UseActionPower, {
                    ...envelope,
                    playerId: 'Ann',
                    cardId: PALANQUIN,
                    powerIndex: powerIndexOf(PALANQUIN, PowerTiming.Action),
                    choices: [
                        { kind: PowerChoiceKind.Player, playerId: 'Dana' },
                        { kind: PowerChoiceKind.Site, siteId: river }
                    ]
                })
            ])
        case 'banish':
            return played(table, [
                createAction(CampaignResolveVictory, {
                    ...envelope,
                    playerId: 'Ann',
                    placements: [],
                    banish: true,
                    burnFavor: true
                })
            ])
    }
}

/** The Brass Horse at the Wood allows only the Order sites. */
export const HORSE_WOOD_SITES = [river, mountain]
