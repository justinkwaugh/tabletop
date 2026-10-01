import {
    assert,
    shuffle,
    type ExplorationPopulation,
    type GameExploration,
    type RandomFunction
} from '@tabletop/common'
import {
    AllAntiques,
    AntiquesPerPlayer,
    coversAntiqueSet,
    type Antique
} from '../components/antiques.js'
import { DirhamIncrement, MaxShopsPerPlayer, MinimumAuctionBid } from '../components/payments.js'
import {
    HydratedMarracashGameState,
    MarracashGameStateValidator,
    type MarracashProjectedState
} from '../model/gameState.js'

const MaxSampleAttempts = 1000

export class MarracashGameExploration implements GameExploration<MarracashProjectedState> {
    createFromCanonicalState(state: MarracashProjectedState): MarracashProjectedState {
        return new HydratedMarracashGameState(structuredClone(state)).dehydrate()
    }

    createFromProjectedState({
        game,
        state,
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
            this.sampleAntiques(sample, knownPlayerId, random)
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

        for (let attempt = 0; attempt < MaxSampleAttempts; attempt++) {
            shuffle(unseen, random)
            const hands = unknownHolders.map((_, index) =>
                unseen.slice(index * AntiquesPerPlayer, (index + 1) * AntiquesPerPlayer)
            )
            const consistent = unknownHolders.every(
                (player, index) =>
                    !coversAntiqueSet(hands[index], sample.customersByColor(player.playerId))
            )
            if (consistent) {
                unknownHolders.forEach((player, index) => {
                    player.antiques = hands[index]
                })
                sample.antiqueDeck.items = unseen.slice(unknownHolders.length * AntiquesPerPlayer)
                return
            }
        }
        throw Error(
            `No antique hands consistent with the game found in ${MaxSampleAttempts} attempts`
        )
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
        for (const participant of auction.participants) {
            if (!participant.submitted || participant.bid !== undefined) {
                continue
            }
            assert(participant.playerId !== knownPlayerId, 'A known bid cannot be missing')
            if (sample.ownedShopCount(participant.playerId) >= MaxShopsPerPlayer) {
                participant.bid = 0
                continue
            }
            const minimum = participant.playerId === auction.auctioneerId ? MinimumAuctionBid : 0
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
