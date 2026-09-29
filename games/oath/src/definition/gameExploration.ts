import { shuffle, type GameExploration, type RandomFunction } from '@tabletop/common'
import { HydratedOathGameState, type OathProjectedState } from '../model/gameState.js'
import { CardKind, Region } from '../model/oathEnums.js'
import { kindOf } from '../data/cardRegistry.js'
import type { OathVault } from '../model/vault.js'

/** R-9.4 — re-deals unknown cards from a new protected stream, so a branch foretells nothing. */
export class OathGameExploration implements GameExploration<OathProjectedState> {
    createFromCanonicalState(state: OathProjectedState): OathProjectedState {
        const hydrated = new HydratedOathGameState(structuredClone(state))
        const vault = hydrated.requireVault()
        const random = hydrated.getProtectedPrng().random
        vault.worldDeck = reshuffledWorldDeck(vault.worldDeck, random)
        for (const region of Object.values(Region)) {
            vault.discardPiles[region] = withTopBackKept(vault.discardPiles[region], random)
        }
        shuffle(vault.dispossessed, random)
        redealSites(vault, random)
        redealRelics(vault, peekedRelicSlots(hydrated), random)
        return hydrated.dehydrate()
    }
}

function isVision(cardId: string): boolean {
    return kindOf(cardId) === CardKind.Vision
}

/** R-8.8 keeps every Vision above the deck's Vision-free tail, and R-9.4 shows the top back. */
function reshuffledWorldDeck(deck: readonly string[], random: RandomFunction): string[] {
    const reach = deck.findLastIndex(isVision) + 1
    const visions = deck.filter(isVision)
    const denizens = deck.filter((cardId) => !isVision(cardId))
    shuffle(denizens, random)
    const head = [...visions, ...denizens.splice(0, reach - visions.length)]
    shuffle(head, random)
    return keepTopBack(deck, [...head, ...denizens], reach)
}

/** R-9.4 — a discard pile's top back is public. */
function withTopBackKept(pile: readonly string[], random: RandomFunction): string[] {
    const reshuffled = [...pile]
    shuffle(reshuffled, random)
    return keepTopBack(pile, reshuffled, reshuffled.length)
}

// R-9.4 — the swap stays within `within` so a Vision never leaves R-8.8's reach.
function keepTopBack(source: readonly string[], cards: string[], within: number): string[] {
    const top = source[0]
    if (top === undefined) return cards
    const back = kindOf(top)
    const index = cards.findIndex((cardId, at) => at < within && kindOf(cardId) === back)
    if (index > 0) [cards[0], cards[index]] = [cards[index], cards[0]]
    return cards
}

/** R-2.8.2, R-8.3.5.6 — a facedown site may be any site no player has seen. */
function redealSites(vault: OathVault, random: RandomFunction) {
    const slots = Object.keys(vault.siteFacedown)
    const pool = [...Object.values(vault.siteFacedown), ...vault.siteDeck]
    shuffle(pool, random)
    vault.siteFacedown = Object.fromEntries(slots.map((slotId, index) => [slotId, pool[index]]))
    vault.siteDeck = pool.slice(slots.length)
}

/** R-1.17, R-1.18, R-6.3 — a facedown relic someone has peeked at stays the relic they saw. */
function redealRelics(vault: OathVault, peeked: ReadonlySet<string>, random: RandomFunction) {
    const slots = Object.keys(vault.relicFacedown).filter((slotId) => !peeked.has(slotId))
    const pool = [...slots.map((slotId) => vault.relicFacedown[slotId]), ...vault.relicDeck]
    shuffle(pool, random)
    for (const [index, slotId] of slots.entries()) vault.relicFacedown[slotId] = pool[index]
    vault.relicDeck = pool.slice(slots.length)
}

function peekedRelicSlots(state: HydratedOathGameState): Set<string> {
    return new Set(state.players.flatMap((player) => player.peekedRelicSlotIds))
}
