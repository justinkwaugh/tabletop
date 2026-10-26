import { describe, expect, it } from 'vitest'
import { ActionSource, GameEngine, PlayerStatus, assertExists } from '@tabletop/common'
import { stockCertificateCount } from '@tabletop/18xx'
import { ownerPortfolio, withDraftedCompanies } from '@tabletop/18xx-ui'
import {
    Definition,
    EndingRules1846,
    Runtime,
    StockRules1846,
    choicesFor,
    hiddenDistribution,
    hydrateEighteenFortySixState,
    isBlank,
    type EighteenFortySixProjectedState
} from '@tabletop/1846'

function draftUntilReveal(count: number, seed: number) {
    const engine = new GameEngine(Runtime)
    const game = engine.startGame(
        Runtime.initializer.initializeGame(
            {
                id: '1846-drafted',
                typeId: '1846',
                ownerId: 'p1',
                seed,
                players: Array.from({ length: count }, (_, index) => ({
                    id: `p${index + 1}`,
                    userId: `p${index + 1}`,
                    name: `Player ${index + 1}`,
                    isHuman: true,
                    status: PlayerStatus.Joined
                }))
            },
            Definition
        ),
        seed.toString(16).padStart(32, '0')
    )
    let state = game.initialState
    let beforeReveal = state
    while (state.machineState === 'Drafting') {
        beforeReveal = state
        const playerId = state.activePlayerIds[0]
        const finalOffer = hiddenDistribution(state).finalOffer
        const choices = choicesFor(hydrateEighteenFortySixState(state), playerId)
        const cardId = choices.find((id) => !isBlank(id)) ?? choices[0]
        assertExists(finalOffer ?? cardId, 'The draft offers a choice')
        state = engine.executeCanonicalAction({
            game: game.startedGame,
            state,
            action: {
                id: `draft:${state.actionCount}`,
                gameId: state.gameId,
                source: ActionSource.User,
                playerId,
                type: finalOffer ? 'PassFinalCompany' : 'ChooseDraftCard',
                revealsInfo: true,
                ...(finalOffer ? {} : { cardId })
            }
        }).updatedState
    }
    return { beforeReveal, revealed: state }
}

function drafted(state: EighteenFortySixProjectedState, playerId: string) {
    const selections = hiddenDistribution(state).participants.find(
        (participant) => participant.playerId === playerId
    )?.selections
    assertExists(selections, 'The canonical draft holds every selection')
    return selections
        .filter((selection) => !isBlank(selection.cardId))
        .map((selection) => ({ companyId: selection.cardId, price: selection.price }))
}

describe('drafted companies', () => {
    it.each([
        [3, 7, true],
        [4, 11, true],
        [5, 3, false],
        [3, 7, false]
    ])(
        'a %i-player draft (seed %i, minors as privates %s) shows each portfolio as the reveal leaves it',
        (count, seed, minorsAsPrivates) => {
            const { beforeReveal, revealed } = draftUntilReveal(count, seed)
            const lastChooser = beforeReveal.activePlayerIds[0]
            const players = beforeReveal.players
                .map((player) => player.playerId)
                .filter((playerId) => playerId !== lastChooser)
            expect(players.some((playerId) => drafted(beforeReveal, playerId).length)).toBe(true)
            for (const playerId of players) {
                const owner = { kind: 'player', playerId } as const
                const charters = StockRules1846.charters
                const during = withDraftedCompanies(
                    ownerPortfolio(
                        beforeReveal,
                        owner,
                        EndingRules1846,
                        charters,
                        minorsAsPrivates
                    ),
                    beforeReveal,
                    drafted(beforeReveal, playerId),
                    EndingRules1846,
                    charters,
                    minorsAsPrivates
                )
                const after = ownerPortfolio(
                    revealed,
                    owner,
                    EndingRules1846,
                    charters,
                    minorsAsPrivates
                )
                expect(during.cash).toBe(after.cash)
                expect(during.netWorth).toBe(after.netWorth)
                expect(during.shares).toBe(after.shares)
                expect(sorted(during.privates)).toEqual(sorted(after.privates))
                expect(
                    stockCertificateCount(beforeReveal, owner, StockRules1846) +
                        drafted(beforeReveal, playerId).length
                ).toBe(stockCertificateCount(revealed, owner, StockRules1846))
            }
        }
    )
})

function sorted(privates: readonly { company: { id: string }; income: number; value: number }[]) {
    return privates
        .map(({ company, income, value }) => ({ id: company.id, income, value }))
        .toSorted((left, right) => left.id.localeCompare(right.id))
}
