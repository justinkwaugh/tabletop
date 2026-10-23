import { ActionSource, Color, createAction } from '@tabletop/common'
import {
    ActionType,
    CURRENT_OATH_REVISION,
    ClaimDealKept,
    IMPERIAL_WARBANDS,
    MAX_OPEN_DEALS_PER_PLAYER,
    MachineState,
    OathRevision,
    OathType,
    PlayerStatus,
    PowerQuestionKind,
    Region,
    ResolveWake,
    TRIBUNAL_ID,
    allMapSlots,
    mapSlotsFor,
    type ExchangeTerms,
    type OpenDeal
} from '@tabletop/oath'
import { openTurn, testPlayer, testState, testVaultWithRelics } from '@tabletop/oath/testing'
import { played, tableOf, type PlayedTable } from './sessionHarness.js'

/**
 * `offer`: Dana's Act Phase at the Tribunal, in a game at the current revision. `full`: the same,
 * with Rhys party to five open deals. `before`: the same, in a game started before the deals.
 */
export type TribunalOfferScene = 'offer' | 'full' | 'before'

/** What each side promises in the offer `tribunalAnswerTable` puts to Rhys. */
export const TRIBUNAL_PROMISES = {
    fromProposer: 'I will not campaign against you before the end of round 5.',
    fromCounterparty: 'I will travel to the Hinterland on my next turn.\nAnd stay there a round.'
} as const

function seats(home: string) {
    return [
        testPlayer({
            playerId: 'dana',
            color: Color.Purple,
            status: PlayerStatus.Chancellor,
            siteId: home,
            favor: 4,
            secrets: 2,
            relicIds: ['relic.cup-of-plenty'],
            warbandsOnBoard: { [IMPERIAL_WARBANDS]: 6 },
            warbandsInPersonalBank: { [IMPERIAL_WARBANDS]: 16 }
        }),
        testPlayer({
            playerId: 'rhys',
            color: Color.Red,
            siteId: home,
            favor: 1,
            secrets: 1,
            relicIds: ['relic.bandit-crown'],
            warbandsOnBoard: { rhys: 2 }
        }),
        testPlayer({
            playerId: 'ann',
            color: Color.Blue,
            status: PlayerStatus.Citizen,
            siteId: home,
            favor: 2,
            secrets: 1,
            warbandsOnBoard: { ann: 2 }
        })
    ]
}

/** R-7.6.3-H1 — Rhys's open deals with Ann, as many as one player may be party to. */
function fullDeals(): OpenDeal[] {
    return Array.from({ length: MAX_OPEN_DEALS_PER_PLAYER }, (_, i) => ({
        id: `1.${i}`,
        proposerPlayerId: 'rhys',
        counterpartyPlayerId: 'ann',
        proposerPromise: `Promise ${i + 1}`,
        round: 1
    }))
}

/**
 * R-11.9, R-7.6.3-H1 — Dana, the Chancellor, stands at the Tribunal with Rhys, an Exile, and Ann,
 * a Citizen. Dana holds 4 favor, 2 secrets and the Cup of Plenty; Rhys 1 favor, 1 secret and the
 * Bandit Crown; Ann 2 favor and 1 secret.
 */
export function tribunalOfferTable(scene: TribunalOfferScene): PlayedTable {
    const [home] = mapSlotsFor(Region.Cradle)
    const state = testState(seats(home), {
        machineState: MachineState.ActPhase,
        oathRevision: scene === 'before' ? OathRevision.UiBatch1 : CURRENT_OATH_REVISION,
        chancellorPlayerId: 'dana',
        map: allMapSlots(),
        siteCards: { [home]: TRIBUNAL_ID },
        denizensBySite: { [home]: [] },
        warbandsBySite: { [home]: { [IMPERIAL_WARBANDS]: 2 } },
        ...(scene === 'full' ? { openDeals: fullDeals() } : {})
    })
    openTurn(state, 'dana')
    state.activePlayerIds = ['dana']
    state.vault = testVaultWithRelics({})
    return tableOf(state)
}

/**
 * R-7.6.3-H1 — the Tribunal's offer put to Rhys on Dana's turn: 2 favor for 1 secret, a promise
 * each way (Rhys's over two lines). Ann is a third seat.
 */
export function tribunalAnswerTable(): PlayedTable {
    const [home] = mapSlotsFor(Region.Cradle)
    const terms: ExchangeTerms = {
        fromProposer: { favor: 2 },
        fromCounterparty: { secrets: 1 },
        promises: { ...TRIBUNAL_PROMISES }
    }
    const state = testState(seats(home), {
        machineState: MachineState.PowerQuestion,
        oathRevision: CURRENT_OATH_REVISION,
        chancellorPlayerId: 'dana',
        map: allMapSlots(),
        siteCards: { [home]: TRIBUNAL_ID },
        denizensBySite: { [home]: [] },
        pendingQuestions: {
            queue: [
                {
                    kind: PowerQuestionKind.Exchange,
                    cardId: TRIBUNAL_ID,
                    askedPlayerId: 'rhys',
                    proposerPlayerId: 'dana',
                    terms
                }
            ],
            askingPlayerId: 'dana',
            resumeMachineState: MachineState.ActPhase
        }
    })
    openTurn(state, 'dana')
    state.activePlayerIds = ['rhys']
    state.vault = testVaultWithRelics({})
    return tableOf(state)
}

/**
 * `resolve`: Dana's Act Phase in round 4, party to two open deals: one with Rhys, made in round 3, a
 * promise each way; one with Ann, made this round, Ann's promise alone, which Dana already claimed
 * kept this turn. `asked`: Dana has claimed the deal with Rhys kept, and Rhys is asked. `ended`: the
 * game ends at Rhys's Wake, Rhys winning as Usurper, with both deals still open.
 */
export type TribunalDealsScene = 'resolve' | 'asked' | 'ended'

/** Ann's promise in the deal she made with Dana. */
export const ANN_PROMISE = 'I will offer you Citizenship on my next turn.'

/** R-7.6.3-H1 — Dana's two open deals. */
function dealsOnTheTable(): OpenDeal[] {
    return [
        {
            id: '3.7',
            proposerPlayerId: 'dana',
            counterpartyPlayerId: 'rhys',
            proposerPromise: TRIBUNAL_PROMISES.fromProposer,
            counterpartyPromise: TRIBUNAL_PROMISES.fromCounterparty,
            round: 3
        },
        {
            id: '4.2',
            proposerPlayerId: 'ann',
            counterpartyPlayerId: 'dana',
            proposerPromise: ANN_PROMISE,
            round: 4,
            lastClaimedTurn: { round: 4, playerId: 'dana' }
        }
    ]
}

/** R-7.6.3-H1 — Dana, Rhys and Ann at the Tribunal in round 4, with Dana's two open deals. */
export function tribunalDealsTable(scene: TribunalDealsScene): PlayedTable {
    const [home] = mapSlotsFor(Region.Cradle)
    const ending = scene === 'ended'
    const state = testState(seats(home), {
        machineState: ending ? MachineState.WakePhase : MachineState.ActPhase,
        oathRevision: CURRENT_OATH_REVISION,
        chancellorPlayerId: 'dana',
        round: 4,
        map: allMapSlots(),
        siteCards: { [home]: TRIBUNAL_ID },
        denizensBySite: { [home]: [] },
        warbandsBySite: { [home]: { [IMPERIAL_WARBANDS]: 2 } },
        openDeals: dealsOnTheTable(),
        oathType: OathType.Supremacy,
        // R-3.1 — Rhys, an Exile and the Usurper, wins at their Wake. Otherwise Dana, who rules the
        // only ruled site, already keeps the Oath, so no action moves the title.
        ...(ending
            ? { oathkeeperPlayerId: 'rhys', oathkeeperIsUsurper: true }
            : { oathkeeperPlayerId: 'dana' })
    })
    const seat = ending ? 'rhys' : 'dana'
    openTurn(state, seat)
    state.activePlayerIds = [seat]
    state.vault = testVaultWithRelics({})
    const table = tableOf(state)
    const envelope = { gameId: table.state.gameId, source: ActionSource.User }
    if (scene === 'asked') {
        return played(table, [
            createAction(ClaimDealKept, {
                ...envelope,
                type: ActionType.ClaimDealKept,
                playerId: 'dana',
                dealId: '3.7'
            })
        ])
    }
    if (ending) {
        return played(table, [
            createAction(ResolveWake, {
                ...envelope,
                type: ActionType.ResolveWake,
                playerId: 'rhys',
                favorSteps: []
            })
        ])
    }
    return table
}
