import {
    assert,
    assertExists,
    type ExplorationPopulation,
    type GameAction,
    type GameExploration,
    type RandomFunction
} from '@tabletop/common'
import { isMoveVisitors } from '../actions/moveVisitors.js'
import {
    AllAntiques,
    AntiquesPerPlayer,
    coversAntiqueSet,
    dealAntiqueHands,
    type Antique
} from '../components/antiques.js'
import { getShop } from '../components/board.js'
import { DirhamIncrement } from '../components/payments.js'
import {
    HydratedMarracashGameState,
    MarracashGameStateValidator,
    TurnAction,
    type MarracashProjectedState,
    type ShopEntry
} from '../model/gameState.js'
import type { MarketColor } from './marketColor.js'

const MaxSampleAttempts = 1000

export class MarracashGameExploration implements GameExploration<MarracashProjectedState> {
    createFromCanonicalState(state: MarracashProjectedState): MarracashProjectedState {
        return new HydratedMarracashGameState(structuredClone(state)).dehydrate()
    }

    createFromProjectedState({
        game,
        state,
        actions,
        perspective,
        random
    }: ExplorationPopulation<MarracashProjectedState>): MarracashProjectedState {
        assert(
            game.config?.concealedCash !== true,
            'Exploration is unavailable with Concealed Cash'
        )
        const sample = new HydratedMarracashGameState(structuredClone(state))
        const knownPlayerId = perspective.kind === 'player' ? perspective.playerId : undefined
        if (sample.antiqueCards) {
            this.sampleAntiques(sample, knownPlayerId, actions, random)
        }
        this.sampleSealedBids(sample, knownPlayerId, random)

        const result = sample.dehydrate()
        assert(
            MarracashGameStateValidator.Check(result),
            'Exploration must produce a complete MarraCash state'
        )
        return result
    }

    private sampleAntiques(
        sample: HydratedMarracashGameState,
        knownPlayerId: string | undefined,
        actions: readonly GameAction[],
        random: RandomFunction
    ) {
        const unknownHolders = sample.players.filter(
            (player) => player.playerId !== knownPlayerId && player.revealedAntiques.length === 0
        )
        const seen = sample.players.flatMap((player) =>
            player.playerId === knownPlayerId
                ? [...player.antiques, ...player.revealedAntiques]
                : player.revealedAntiques
        )
        const unseen = this.withoutCards(AllAntiques, seen)
        assert(
            unseen.length ===
                unknownHolders.length * AntiquesPerPlayer + sample.antiqueDeck.remaining,
            'Exploration antique count does not match the source'
        )

        const turnEntries = this.uncommittedShopEntries(sample, actions)
        for (let attempt = 0; attempt < MaxSampleAttempts; attempt++) {
            const deal = dealAntiqueHands(unseen, unknownHolders.length, random)
            if (!deal) {
                continue
            }
            const consistent = unknownHolders.every(
                (player, index) =>
                    !coversAntiqueSet(
                        deal.hands[index],
                        this.customersBeforeTurn(sample, player.playerId, turnEntries)
                    )
            )
            if (consistent) {
                unknownHolders.forEach((player, index) => {
                    player.antiques = deal.hands[index]
                })
                sample.antiqueDeck.items = deal.undealt
                sample.pendingAntiqueSets = this.pendingAntiqueSets(sample, turnEntries)
                return
            }
        }
        throw Error(
            `No antique hands consistent with the game found in ${MaxSampleAttempts} attempts`
        )
    }

    // Starting an auction commits the moves before it, so only a turn without one has unpaid sets.
    private uncommittedShopEntries(
        sample: HydratedMarracashGameState,
        actions: readonly GameAction[]
    ): ShopEntry[] {
        const moveCount = sample.turnActions.filter((action) => action === TurnAction.Move).length
        if (moveCount === 0 || sample.turnActions.includes(TurnAction.Auction)) {
            return []
        }
        return actions
            .filter(isMoveVisitors)
            .slice(-moveCount)
            .flatMap((move) => {
                assertExists(move.metadata, 'A recorded move has its result')
                return move.metadata.entries
            })
    }

    private customersBeforeTurn(
        sample: HydratedMarracashGameState,
        playerId: string,
        turnEntries: readonly ShopEntry[]
    ): Record<MarketColor, number> {
        const counts = sample.customersByColor(playerId)
        for (const entry of turnEntries) {
            if (entry.ownerId === playerId) {
                counts[getShop(entry.shopId).color] -= entry.customers
            }
        }
        return counts
    }

    // Projections hide unpaid sets from everyone, so they are rebuilt from the sampled hands.
    private pendingAntiqueSets(
        sample: HydratedMarracashGameState,
        turnEntries: readonly ShopEntry[]
    ): string[] {
        const counts = new Map(
            sample.players
                .filter((player) => player.revealedAntiques.length === 0)
                .map((player) => [
                    player.playerId,
                    this.customersBeforeTurn(sample, player.playerId, turnEntries)
                ])
        )
        const pending: string[] = []
        for (const entry of turnEntries) {
            const ownerCounts = counts.get(entry.ownerId)
            if (!ownerCounts || pending.includes(entry.ownerId)) {
                continue
            }
            ownerCounts[getShop(entry.shopId).color] += entry.customers
            if (sample.completesAntiqueSet(entry.ownerId, ownerCounts)) {
                pending.push(entry.ownerId)
            }
        }
        return pending
    }

    private sampleSealedBids(
        sample: HydratedMarracashGameState,
        knownPlayerId: string | undefined,
        random: RandomFunction
    ) {
        const auction = sample.auction
        if (!auction) {
            return
        }
        for (const participant of auction.bidding.participants) {
            if (!participant.submitted || participant.bid !== undefined) {
                continue
            }
            assert(participant.playerId !== knownPlayerId, 'A known bid cannot be missing')
            if (sample.isAtShopLimit(participant.playerId)) {
                participant.bid = 0
                continue
            }
            const minimum = sample.minimumBid(participant.playerId)
            const money = sample.getPlayerState(participant.playerId).getMoney()
            const steps = Math.floor((money - minimum) / DirhamIncrement)
            participant.bid = minimum + Math.floor(random() * (steps + 1)) * DirhamIncrement
        }
    }

    private withoutCards(cards: readonly Antique[], removed: readonly Antique[]): Antique[] {
        const remaining = structuredClone([...cards])
        for (const card of removed) {
            const index = remaining.findIndex(
                (candidate) => candidate.color === card.color && candidate.value === card.value
            )
            assert(index >= 0, `Card ${card.color} ${card.value} is not in the antique population`)
            remaining.splice(index, 1)
        }
        return remaining
    }
}
