import { Color } from '@tabletop/common'
import type { OathGameState, OathProjectedState } from '../model/gameState.js'
import type { AdviserRow, OathPlayerState } from '../model/playerState.js'
import { PlayerStatus } from '../model/oathEnums.js'
import { IMPERIAL_WARBANDS } from '../model/warbandCounts.js'
import { MachineState } from '../definition/states.js'
import { openTurn, testPlayer, testState } from './fixture.js'
import { TENTS } from './cards.js'

export function adviser(cardId: string, faceUp = true): AdviserRow {
    return { cardId, faceUp }
}

/**
 * 'ruler' (Red) holds the turn at c1 (Plains, capacity 3) and rules it, with `cards` there and
 * `advisers` faceup; 'other' (Blue) shares c1 with Tents faceup; 'away' (Yellow) is at h1.
 * Turn order follows the seats: ruler, other, away.
 */
export function rulerTable(
    cards: string[],
    advisers: string[] = [],
    over: Record<string, Record<string, unknown>> = {},
    state: Record<string, unknown> = {}
) {
    const s = testState(
        [
            testPlayer({
                playerId: 'ruler',
                color: Color.Red,
                siteId: 'c1',
                favor: 3,
                secrets: 3,
                supply: 4,
                warbandsOnBoard: { ruler: 4 },
                warbandsInPersonalBank: { ruler: 6 },
                advisers: advisers.map((cardId) => adviser(cardId)),
                ...over['ruler']
            }),
            testPlayer({
                playerId: 'other',
                color: Color.Blue,
                siteId: 'c1',
                favor: 2,
                secrets: 2,
                warbandsOnBoard: { other: 2 },
                warbandsInPersonalBank: { other: 5 },
                advisers: [adviser(TENTS)],
                ...over['other']
            }),
            testPlayer({
                playerId: 'away',
                color: Color.Yellow,
                siteId: 'h1',
                favor: 1,
                secrets: 1,
                ...over['away']
            })
        ],
        {
            denizensBySite: { c1: cards, c2: [], p1: [], h1: [] },
            warbandsBySite: {
                c1: { ruler: 1 },
                c2: { ruler: 2 },
                p1: { other: 3 }
            },
            siteCards: {
                c1: 'site.plains',
                c2: 'site.river',
                p1: 'site.marshes',
                h1: 'site.mountain'
            },
            ...state
        }
    )
    openTurn(s, 'ruler')
    return s
}

export const CHANCELLOR = 'chancellor'
export const CITIZEN = 'citizen'
export const EXILE = 'exile'
export const OTHER_EXILE = 'otherExile'

/** One seat of each status, and a second Exile; no pawns placed. */
export function statusTable(
    overrides: Partial<OathGameState> = {},
    playerOverrides: Record<string, Partial<OathPlayerState>> = {}
) {
    const seats: OathPlayerState[] = [
        testPlayer({
            playerId: CHANCELLOR,
            color: Color.Purple,
            status: PlayerStatus.Chancellor,
            warbandsInPersonalBank: { [IMPERIAL_WARBANDS]: 24 },
            ...playerOverrides[CHANCELLOR]
        }),
        testPlayer({
            playerId: CITIZEN,
            color: Color.Blue,
            status: PlayerStatus.Citizen,
            warbandsInPersonalBank: { [CITIZEN]: 14 },
            ...playerOverrides[CITIZEN]
        }),
        testPlayer({
            playerId: EXILE,
            color: Color.Red,
            status: PlayerStatus.Exile,
            warbandsInPersonalBank: { [EXILE]: 14 },
            ...playerOverrides[EXILE]
        }),
        testPlayer({
            playerId: OTHER_EXILE,
            color: Color.Yellow,
            status: PlayerStatus.Exile,
            warbandsInPersonalBank: { [OTHER_EXILE]: 14 },
            ...playerOverrides[OTHER_EXILE]
        })
    ]
    return testState(seats, { chancellorPlayerId: CHANCELLOR, ...overrides })
}

/**
 * 'p1' (the Chancellor, at c1) and 'p2' (an Exile, at c2) in the Act Phase, on `turnOf`'s turn;
 * a seat before it in turn order has had its turn.
 */
export function twoSeatActPhase(
    turnOf: string,
    overrides: Partial<OathProjectedState> = {}
): OathProjectedState {
    const state = testState(
        [
            testPlayer({
                playerId: 'p1',
                color: Color.Purple,
                status: PlayerStatus.Chancellor,
                siteId: 'c1',
                warbandsInPersonalBank: { [IMPERIAL_WARBANDS]: 5 }
            }),
            testPlayer({
                playerId: 'p2',
                color: Color.Red,
                status: PlayerStatus.Exile,
                siteId: 'c2',
                warbandsInPersonalBank: { p2: 4 }
            })
        ],
        { machineState: MachineState.ActPhase, chancellorPlayerId: 'p1', ...overrides }
    ).dehydrate()
    const turnOrder = ['p1', 'p2']
    state.turnManager = {
        series: [{ type: 'turn', playerId: turnOf, start: 0 }],
        turnOrder,
        turnCounts: Object.fromEntries(
            turnOrder.map((id, index) => [id, index < turnOrder.indexOf(turnOf) ? 1 : 0])
        )
    }
    state.activePlayerIds = [turnOf]
    return state
}
