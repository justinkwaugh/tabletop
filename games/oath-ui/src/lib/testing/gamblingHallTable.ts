import { ActionSource, Color, createAction } from '@tabletop/common'
import {
    AnswerQuestion,
    CURRENT_OATH_REVISION,
    MachineState,
    PlayerStatus,
    PowerTiming,
    Region,
    Suit,
    UseActionPower,
    allMapSlots,
    mapSlotsFor,
    powerIndexOf,
    type QuestionAnswer
} from '@tabletop/oath'
import { openTurn, testPlayer, testState } from '@tabletop/oath/testing'
import { played, tableOf, type PlayedTable } from './sessionHarness.js'

export const GAMBLING_HALL = 'denizen.discord.gambling-hall'
export const JINX = 'denizen.arcane.jinx'

/** Every bank but the Beast's holds favor. */
export const BANKS: Record<Suit, number> = {
    [Suit.Discord]: 3,
    [Suit.Arcane]: 2,
    [Suit.Order]: 4,
    [Suit.Hearth]: 1,
    [Suit.Beast]: 0,
    [Suit.Nomad]: 3
}

/** Its first four defense dice: shield, two shields, blank, doubling — (1 + 2) × 2 = 6. */
export const SIX_SEED = 592

export interface GamblingHallScene {
    jinx?: boolean
    banks?: Partial<Record<Suit, number>>
    seed?: number
}

/**
 * R-7.1.3-H2 — Dana rules Gambling Hall at the Drowned City and is on turn; Ann (the Chancellor)
 * and Rhys stand there too. With `jinx` Dana also rules Jinx.
 */
export function gamblingHallUsed(
    { jinx = false, banks = BANKS, seed = SIX_SEED }: GamblingHallScene = {},
    answers: QuestionAnswer[] = []
): PlayedTable {
    const [home, plains] = mapSlotsFor(Region.Cradle)
    const state = testState(
        [
            testPlayer({
                playerId: 'Dana',
                color: Color.Red,
                siteId: home,
                favor: 4,
                secrets: 2,
                warbandsOnBoard: { Dana: 3 },
                advisers: jinx ? [{ cardId: JINX, faceUp: true }] : []
            }),
            testPlayer({
                playerId: 'Ann',
                color: Color.Purple,
                status: PlayerStatus.Chancellor,
                siteId: home,
                favor: 3,
                secrets: 1
            }),
            testPlayer({ playerId: 'Rhys', color: Color.Blue, siteId: home, favor: 2, secrets: 1 })
        ],
        {
            machineState: MachineState.ActPhase,
            chancellorPlayerId: 'Ann',
            // Dana already leads the Oath, so the History holds only the power's rows.
            oathkeeperPlayerId: 'Dana',
            oathRevision: CURRENT_OATH_REVISION,
            prng: { seed, invocations: 0 },
            map: allMapSlots(),
            siteCards: { [home]: 'site.drowned-city', [plains]: 'site.plains' },
            denizensBySite: { [home]: [GAMBLING_HALL], [plains]: [] },
            warbandsBySite: { [home]: { Dana: 1 } }
        }
    )
    for (const suit of Object.values(Suit)) state.favorBank[suit] = banks[suit] ?? 0
    openTurn(state, 'Dana')
    state.activePlayerIds = ['Dana']
    const table = tableOf(state)
    const envelope = { gameId: table.state.gameId, source: ActionSource.User }
    return played(table, [
        createAction(UseActionPower, {
            ...envelope,
            playerId: 'Dana',
            cardId: GAMBLING_HALL,
            powerIndex: powerIndexOf(GAMBLING_HALL, PowerTiming.Action)
        }),
        ...answers.map((answer) =>
            createAction(AnswerQuestion, { ...envelope, playerId: 'Dana', answer })
        )
    ])
}
