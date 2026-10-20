import { describe, expect, it } from 'vitest'
import { Color } from '@tabletop/common'
import { PlayerStatus, Suit } from '../model/oathEnums.js'
import { testPlayer, testState } from '../testing/fixture.js'
import { expectFavorConserved } from '../testing/census.js'
import {
    CHANCELLOR_REFRESH_BANDS,
    EXILE_REFRESH_BANDS,
    MAX_SUPPLY,
    refreshSpaceFor,
    gainSupply,
    refreshSupply,
    returnFavorFromCards,
    returnSecretsToBoard
} from './rest.js'
import type { OathGameState } from '../model/gameState.js'
import type { OathPlayerState } from '../model/playerState.js'
import { VISIONS_DRAWN_SUPPLY_COST } from '../data/visionsDrawnTrack.js'
import { FILLER as ORDER_CARD } from '../testing/cards.js'
import { IMPERIAL_WARBANDS } from '../model/warbandCounts.js'
import { OathRevision } from './revision.js'

const CHANCELLOR = 'chancellor'
const CITIZEN = 'citizen'
const EXILE = 'exile'

const BEAST_CARD = 'denizen.beast.rangers'
const RELIC = 'relic.cup'

function table(
    overrides: Partial<OathGameState> = {},
    playerOverrides: Record<string, Partial<OathPlayerState>> = {}
) {
    const seats: OathPlayerState[] = [
        testPlayer({
            playerId: CHANCELLOR,
            color: Color.Purple,
            status: PlayerStatus.Chancellor,
            warbandsInPersonalBank: { [IMPERIAL_WARBANDS]: 5 },
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
            warbandsInPersonalBank: { [EXILE]: 4 },
            ...playerOverrides[EXILE]
        })
    ]
    return testState(seats, { chancellorPlayerId: CHANCELLOR, ...overrides })
}

describe('R-4.3.3 — the Supply refresh is banded, not linear', () => {
    it('an Exile track reads 9+ / 8 to 4 / 3 to 0 onto Supply 6 / 5 / 4', () => {
        const at = (n: number) => refreshSpaceFor(EXILE_REFRESH_BANDS, n)
        expect([at(14), at(10), at(9)]).toEqual([6, 6, 6])
        expect([at(8), at(6), at(4)]).toEqual([5, 5, 5])
        expect([at(3), at(1), at(0)]).toEqual([4, 4, 4])
    })

    it('the Chancellor track reads 18+ / 17 to 11 / 10 to 4 / 3 to 0 onto 6 / 5 / 4 / 3', () => {
        const at = (n: number) => refreshSpaceFor(CHANCELLOR_REFRESH_BANDS, n)
        expect([at(24), at(18)]).toEqual([6, 6])
        expect([at(17), at(11)]).toEqual([5, 5])
        expect([at(10), at(4)]).toEqual([4, 4])
        expect([at(3), at(0)]).toEqual([3, 3])
    })

    it('a player stripped of warbands still refreshes to their band floor', () => {
        expect(refreshSpaceFor(EXILE_REFRESH_BANDS, 0)).toBe(4)
        expect(refreshSpaceFor(CHANCELLOR_REFRESH_BANDS, 0)).toBe(3)
    })

    it('no band reaches the leftmost space — only R-4.3.4’s saving does', () => {
        for (const bands of [EXILE_REFRESH_BANDS, CHANCELLOR_REFRESH_BANDS]) {
            for (const band of bands) {
                expect(band.supply).toBeLessThan(MAX_SUPPLY)
            }
        }
    })

    it('every band table covers zero, so a lookup can never fall through', () => {
        for (const bands of [EXILE_REFRESH_BANDS, CHANCELLOR_REFRESH_BANDS]) {
            expect(bands[bands.length - 1].minWarbands).toBe(0)
        }
    })
})

/** A fixture with no `oathRevision` predates revision 24 (R-X.4): the turn's ledger is read. */
describe('R-4.3.4-H1 — a mid-turn Supply gain, before revision 24', () => {
    function exile(overrides: Partial<OathPlayerState> = {}) {
        return testState([
            testPlayer({
                playerId: 'p1',
                color: Color.Red,
                status: PlayerStatus.Exile,
                warbandsInPersonalBank: { p1: 2 }, // R-4.3.3 — base 4
                ...overrides
            })
        ])
    }

    it('moves the marker and raises the turn baseline together', () => {
        const state = exile({ supply: 3, supplyAtTurnStart: 3 })
        expect(gainSupply(state, 'p1', 4)).toBe(4)

        const p = state.getPlayerState('p1')
        expect(p.supply).toBe(7)
        expect(p.supplyAtTurnStart).toBe(7)
    })

    it('stops at the top of the track, crediting only what moved', () => {
        const state = exile({ supply: 5, supplyAtTurnStart: 7, supplySpentThisTurn: 2 })
        expect(gainSupply(state, 'p1', 4)).toBe(2)

        const p = state.getPlayerState('p1')
        expect(p.supply).toBe(7)
        expect(p.supplyAtTurnStart).toBe(9)
    })

    it('spent gains do not cost next turn’s saving', () => {
        const state = exile({ supply: 3, supplyAtTurnStart: 3 })
        gainSupply(state, 'p1', 4)

        const p = state.getPlayerState('p1')
        p.supply -= 4
        p.supplySpentThisTurn += 4

        refreshSupply(state, 'p1')
        expect(p.supply).toBe(7)
    })

    it('a gain never decrements the spent ledger', () => {
        const state = exile({ supply: 1, supplyAtTurnStart: 3, supplySpentThisTurn: 2 })
        gainSupply(state, 'p1', 2)
        expect(state.getPlayerState('p1').supplySpentThisTurn).toBe(2)
    })
})

describe('R-4.3.1 — return favor from cards to matching banks', () => {
    it('sends each card’s favor to its own suit bank (R-10.14)', () => {
        const state = table({
            cardTokens: {
                [ORDER_CARD]: { favor: 2, secrets: 0 },
                [BEAST_CARD]: { favor: 1, secrets: 0 }
            }
        })
        expectFavorConserved(state, () => returnFavorFromCards(state))

        expect(state.favorBank[Suit.Order]).toBe(5)
        expect(state.favorBank[Suit.Beast]).toBe(4)
        expect(state.cardTokens[ORDER_CARD].favor).toBe(0)
    })

    it('leaves favor on a SITE — R-4.3.1 names denizens only', () => {
        const state = table({ cardTokens: { 'site.mine': { favor: 3, secrets: 0 } } })
        returnFavorFromCards(state)
        expect(state.cardTokens['site.mine'].favor).toBe(3)
    })
})

describe('R-4.3.2 — return secrets to the resting player’s board', () => {
    it('collects secrets from denizens and relics alike', () => {
        const state = table({
            cardTokens: {
                [ORDER_CARD]: { favor: 0, secrets: 1 },
                [RELIC]: { favor: 0, secrets: 2 }
            }
        })
        expect(returnSecretsToBoard(state, EXILE)).toBe(3)
        expect(state.getPlayerState(EXILE).secrets).toBe(3)
        expect(state.cardTokens[RELIC].secrets).toBe(0)
    })

    it('takes them to the RESTING player’s board, whoever placed them (R-9.1)', () => {
        const state = table({ cardTokens: { [ORDER_CARD]: { favor: 0, secrets: 1 } } })
        returnSecretsToBoard(state, CHANCELLOR)
        expect(state.getPlayerState(CHANCELLOR).secrets).toBe(1)
        expect(state.getPlayerState(EXILE).secrets).toBe(0)
    })

    it('leaves a site’s secrets alone — R-4.3.2 does not name sites', () => {
        const state = table({ cardTokens: { 'site.mine': { favor: 0, secrets: 2 } } })
        expect(returnSecretsToBoard(state, EXILE)).toBe(0)
        expect(state.cardTokens['site.mine'].secrets).toBe(2)
    })

    it('flips facedown secrets on your board faceup (R-7.1.2.a)', () => {
        const state = table({}, { [EXILE]: { secrets: 1, secretsFacedown: 2 } })
        returnSecretsToBoard(state, EXILE)
        expect(state.getPlayerState(EXILE).secrets).toBe(3)
        expect(state.getPlayerState(EXILE).secretsFacedown).toBe(0)
    })
})

describe('R-4.3.3 / R-4.3.4 — refresh and save Supply', () => {
    it('refreshes an Exile to the band listing their warbands (R-4.3.3)', () => {
        const state = table({}, { [EXILE]: { supply: 0, supplySpentThisTurn: 3 } })
        expect(refreshSupply(state, EXILE)).toBe(5)
        expect(state.getPlayerState(EXILE).supplySpentThisTurn).toBe(0)
    })

    it('refreshes the Chancellor on his OWN band table, not the Exiles’ (R-4.3.3)', () => {
        // 5 banked warbands give Supply 5 on the Exile track but 4 on the Chancellor's.
        const state = table({}, { [CHANCELLOR]: { supply: 0, supplySpentThisTurn: 2 } })
        expect(refreshSupply(state, CHANCELLOR)).toBe(4)
    })

    it('couples a Citizen’s Supply to the Chancellor’s, not their own warbands', () => {
        const state = table(
            {},
            {
                [CHANCELLOR]: { supply: 3 },
                [CITIZEN]: { supply: 0, supplySpentThisTurn: 4 }
            }
        )
        expect(refreshSupply(state, CITIZEN)).toBe(3)
    })

    it('adds one space per Supply not spent (R-4.3.4)', () => {
        const state = table(
            {},
            {
                [EXILE]: {
                    supply: 2,
                    supplySpentThisTurn: 1,
                    warbandsInPersonalBank: { [EXILE]: 2 }
                }
            }
        )
        expect(refreshSupply(state, EXILE)).toBe(6)
    })

    it('cannot refresh past the leftmost space (R-4.3.4)', () => {
        const state = table(
            {},
            { [EXILE]: { supply: 5, warbandsInPersonalBank: { [EXILE]: 14 } } }
        )
        expect(refreshSupply(state, EXILE)).toBe(MAX_SUPPLY)
    })

    it('resets supplySpentThisTurn so it cannot leak into the next turn', () => {
        const state = table({}, { [EXILE]: { supply: 1, supplySpentThisTurn: 6 } })
        refreshSupply(state, EXILE)
        expect(state.getPlayerState(EXILE).supplySpentThisTurn).toBe(0)
    })
})

/** R-6.6.2, R-6.7, R-6.8 refresh Supply mid-turn; before revision 24 (R-X.4) the ledger is read. */
describe('before revision 24 the Rest saving is the ledger, not the marker (R-4.3.4)', () => {
    it('agrees with the marker when nothing refreshed Supply mid-turn', () => {
        const state = ledgerTable({ supply: 2, supplySpentThisTurn: 5, bank: 2 })
        expect(refreshSupply(state, LEDGER_PLAYER)).toBe(4 + 2)
    })

    it('ignores the marker after a mid-turn refresh has overwritten it', () => {
        // R-6.8 reset the marker to leftmost.
        const state = ledgerTable({
            supply: MAX_SUPPLY,
            supplySpentThisTurn: MAX_SUPPLY,
            bank: 1
        })
        expect(refreshSupply(state, LEDGER_PLAYER)).toBe(4)
    })

    it('awards only what was genuinely left when a refresh follows partial spending', () => {
        const state = ledgerTable({
            supply: MAX_SUPPLY,
            supplySpentThisTurn: 5,
            bank: 1
        })
        expect(refreshSupply(state, LEDGER_PLAYER)).toBe(4 + 2)
    })

    it('still cannot refresh past the leftmost space (R-4.3.4)', () => {
        const state = ledgerTable({ supply: MAX_SUPPLY, supplySpentThisTurn: 0, bank: 6 })
        expect(refreshSupply(state, LEDGER_PLAYER)).toBe(MAX_SUPPLY)
    })

    it('never awards a negative saving if the ledger is inconsistent', () => {
        const state = ledgerTable({ supply: 0, supplySpentThisTurn: 99, bank: 3 })
        expect(refreshSupply(state, LEDGER_PLAYER)).toBe(4)
    })

    it('resets the ledger for the next turn', () => {
        const state = ledgerTable({ supply: 3, supplySpentThisTurn: 4, bank: 2 })
        refreshSupply(state, LEDGER_PLAYER)
        const player = state.getPlayerState(LEDGER_PLAYER)
        expect(player.supplySpentThisTurn).toBe(0)
        expect(player.supplyAtTurnStart).toBe(player.supply)
    })
})

/** R-4.3.4 — "Supply not spent" is the marker as it stands at the Rest, as on the board. */
describe('from revision 24 the Rest saving is the marker (R-4.3.4, R-X.4)', () => {
    const AT = OathRevision.EngineFixes20
    const BEFORE = OathRevision.EngineFixes19

    /** An Exile on base 4 (R-4.3.3: 3 or fewer banked warbands), Supply 7 at the turn's start. */
    function exile(revision: number, overrides: Partial<OathPlayerState> = {}) {
        return testState(
            [
                testPlayer({
                    playerId: 'dana',
                    color: Color.Red,
                    status: PlayerStatus.Exile,
                    supply: MAX_SUPPLY,
                    warbandsInPersonalBank: { dana: 2 },
                    ...overrides
                })
            ],
            { oathRevision: revision }
        )
    }

    function spend(state: ReturnType<typeof exile>, amount: number) {
        state.getPlayerState('dana').spendSupply(amount)
    }

    /** R-6.6.2, R-6.7, R-6.8 move the marker to the leftmost space. */
    function refreshToFull(state: ReturnType<typeof exile>) {
        state.getPlayerState('dana').supply = MAX_SUPPLY
    }

    it('an ordinary turn saves what is left on the marker (5 of 7 spent: 4 + 2), at both revisions', () => {
        for (const revision of [AT, BEFORE]) {
            const state = exile(revision)
            spend(state, 5)
            expect(refreshSupply(state, 'dana')).toBe(4 + 2)
        }
    })

    it('a refresh to full after all 7 were spent saves all 7; before revision 24, none', () => {
        const marker = exile(AT)
        spend(marker, MAX_SUPPLY)
        refreshToFull(marker)
        expect(refreshSupply(marker, 'dana')).toBe(MAX_SUPPLY)

        const ledger = exile(BEFORE)
        spend(ledger, MAX_SUPPLY)
        refreshToFull(ledger)
        expect(refreshSupply(ledger, 'dana')).toBe(4)
    })

    it('a refresh to full after 5 were spent saves 7; before revision 24, the 2 left', () => {
        const marker = exile(AT)
        spend(marker, 5)
        refreshToFull(marker)
        expect(refreshSupply(marker, 'dana')).toBe(MAX_SUPPLY)

        const ledger = exile(BEFORE)
        spend(ledger, 5)
        refreshToFull(ledger)
        expect(refreshSupply(ledger, 'dana')).toBe(4 + 2)
    })

    it('a gain moves the marker only; the saving is the marker left after spending it', () => {
        const state = exile(AT, { supply: 2 })
        expect(gainSupply(state, 'dana', 3)).toBe(3)
        const dana = state.getPlayerState('dana')
        expect(dana.supply).toBe(5)
        expect(dana.supplyAtTurnStart).toBe(2)

        spend(state, 4)
        expect(refreshSupply(state, 'dana')).toBe(4 + 1)
    })

    it('a gain at the top of the track is lost (R-4.3.4-H1)', () => {
        const state = exile(AT)
        expect(gainSupply(state, 'dana', 2)).toBe(0)
        spend(state, 5)
        expect(refreshSupply(state, 'dana')).toBe(4 + 2)
    })

    it('a Citizen whose marker is below the Chancellor’s Supply rests on the Chancellor’s plus the marker', () => {
        const state = table(
            { oathRevision: AT },
            {
                [CHANCELLOR]: { supply: 5 },
                [CITIZEN]: { supply: 1, supplySpentThisTurn: 6 }
            }
        )
        expect(refreshSupply(state, CITIZEN)).toBe(5 + 1)
    })

    it('still cannot refresh past the leftmost space', () => {
        const state = exile(AT, { warbandsInPersonalBank: { dana: 14 } })
        expect(refreshSupply(state, 'dana')).toBe(MAX_SUPPLY)
    })

    it('resets the turn’s fields for the next turn as before, so the stored state keeps its shape', () => {
        const state = exile(AT)
        spend(state, 4)
        refreshSupply(state, 'dana')
        const dana = state.getPlayerState('dana')
        expect(dana.supplySpentThisTurn).toBe(0)
        expect(dana.supplyAtTurnStart).toBe(dana.supply)
    })
})

const LEDGER_PLAYER = 'ledger'

/** R-4.3.3 — a bank of 3 or fewer gives base 4. */
function ledgerTable(opts: { supply: number; supplySpentThisTurn: number; bank: number }) {
    return testState([
        testPlayer({
            playerId: LEDGER_PLAYER,
            color: Color.Red,
            status: PlayerStatus.Exile,
            supply: opts.supply,
            supplyAtTurnStart: MAX_SUPPLY,
            supplySpentThisTurn: opts.supplySpentThisTurn,
            warbandsInPersonalBank: { [LEDGER_PLAYER]: opts.bank }
        })
    ])
}

describe('R-4.3.3 band tables and R-2.1.6 track costs, pinned', () => {
    // The numbers are transcribed from the printed board; these pins make any edit to them visible.
    it('pins every Exile band boundary (esp. the 8-vs-9 edge the findings name)', () => {
        expect(refreshSpaceFor(EXILE_REFRESH_BANDS, 9)).toBe(6)
        expect(refreshSpaceFor(EXILE_REFRESH_BANDS, 8)).toBe(5)
        expect(refreshSpaceFor(EXILE_REFRESH_BANDS, 4)).toBe(5)
        expect(refreshSpaceFor(EXILE_REFRESH_BANDS, 3)).toBe(4)
        expect(refreshSpaceFor(EXILE_REFRESH_BANDS, 0)).toBe(4)
    })

    it('pins every Chancellor band boundary', () => {
        expect(refreshSpaceFor(CHANCELLOR_REFRESH_BANDS, 18)).toBe(6)
        expect(refreshSpaceFor(CHANCELLOR_REFRESH_BANDS, 17)).toBe(5)
        expect(refreshSpaceFor(CHANCELLOR_REFRESH_BANDS, 11)).toBe(5)
        expect(refreshSpaceFor(CHANCELLOR_REFRESH_BANDS, 10)).toBe(4)
        expect(refreshSpaceFor(CHANCELLOR_REFRESH_BANDS, 4)).toBe(4)
        expect(refreshSpaceFor(CHANCELLOR_REFRESH_BANDS, 3)).toBe(3)
        expect(refreshSpaceFor(CHANCELLOR_REFRESH_BANDS, 0)).toBe(3)
    })

    it('pins the Visions Drawn search-cost track (R-2.1.6)', () => {
        expect([...VISIONS_DRAWN_SUPPLY_COST]).toEqual([2, 3, 3, 4, 4, 4])
    })
})
