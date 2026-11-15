import {
    RecordedHistory,
    assert,
    assertExists,
    shuffle,
    type ExplorationPopulation,
    type GameAction,
    type RandomFunction
} from '@tabletop/common'
import { finiteCashOwnedBy } from '@tabletop/18xx'
import { blankCardIds, isBlank } from './catalog.js'
import { hiddenDistribution, packetSize, priceFor } from './distribution.js'
import type { EighteenFortySixProjectedState } from './state.js'

type State = EighteenFortySixProjectedState
type DraftView = Pick<State, 'activePlayerIds' | 'draft'>
// Cards the viewer cannot tell apart: never seen, or passed together in one packet. Each unnamed
// slot holds one card of its group, so a replay only fails when an observed packet draws more or
// fewer cards from a group than the replay put in front of the viewer.
type Group = Set<string>
type Slot = { cardId?: string; group?: Group }
const MaxReplays = 100_000

/**
 * Passed cards go to the bottom of the deck, so what a player saw constrains where cards can be
 * now. Replaying every deal and pick keeps each packet the viewer was shown exactly as it was.
 */
export function populate1846Exploration({
    state: projected,
    actions,
    perspective,
    random
}: ExplorationPopulation<State>): State {
    const state = structuredClone(projected)
    if (state.draft?.kind !== 'hidden') return state
    assert(state.machineState === 'Drafting', 'Exploration samples the draft between choices')
    const views = draftViews(state, actions)
    const viewerId = perspective.kind === 'player' ? perspective.playerId : undefined
    const cards = [
        ...state.certificates
            .filter((certificate) => certificate.id.endsWith(':charter'))
            .map((certificate) => certificate.companyId),
        ...blankCardIds(state.players.length)
    ]
    for (let replay = 0; replay < MaxReplays; replay++) {
        const deal = new DraftReplay(cards, state.players.length, viewerId, random)
        if (!deal.replay(views, actions) || !deal.name()) continue
        if (!deal.affordable(state)) continue
        deal.write(state)
        return state
    }
    throw new Error('No replayed draft matches the packets you were dealt')
}

function draftViews(state: State, actions: readonly GameAction[]): DraftView[] {
    assert(
        actions.length === state.actionCount &&
            actions.every(
                (action, index) =>
                    action.index === index &&
                    (action.type === 'ChooseDraftCard' || action.type === 'PassFinalCompany')
            ),
        'Exploration requires the complete draft history'
    )
    const recorded = new RecordedHistory(state, actions).select(
        ({ activePlayerIds, draft }): DraftView => ({ activePlayerIds, draft })
    )
    const views = actions.map((action) => {
        const before = recorded.get(action.id)?.before
        assertExists(before, 'Exploration requires your recorded view of every draft turn')
        return before
    })
    return [...views, { activePlayerIds: state.activePlayerIds, draft: state.draft }]
}

class DraftReplay {
    private readonly deck: Slot[]
    private readonly packets = new Map<string, Slot[]>()
    private readonly selections = new Map<string, Slot[]>()
    private readonly groupOf = new Map<string, Group>()
    private readonly dealtFrom: Slot[][] = []

    constructor(
        cards: readonly string[],
        private readonly playerCount: number,
        private readonly viewerId: string | undefined,
        private readonly random: RandomFunction
    ) {
        const unseen: Group = new Set(cards)
        for (const cardId of cards) this.groupOf.set(cardId, unseen)
        this.deck = cards.map(() => ({ group: unseen }))
    }

    replay(views: readonly DraftView[], actions: readonly GameAction[]): boolean {
        const [opening] = views
        if (!this.deal(opening)) return false
        return actions.every((action, index) => {
            const playerId = action.playerId
            assertExists(playerId, 'Draft turns belong to players')
            const packet = this.packets.get(playerId) ?? []
            this.packets.set(playerId, [])
            if (action.type === 'PassFinalCompany') {
                this.packets.set(views[index + 1].activePlayerIds[0], packet)
                return true
            }
            const kept = this.keep(playerId, packet, action)
            this.selections.set(playerId, [...(this.selections.get(playerId) ?? []), kept])
            this.deck.push(...this.returned(playerId, packet, kept))
            return this.deal(views[index + 1])
        })
    }

    /** Names every remaining slot from its group, then rejects decks the rules would not have dealt from. */
    name(): boolean {
        const unnamed = [
            ...this.deck,
            ...[...this.packets.values(), ...this.selections.values()].flat()
        ].filter((slot) => slot.cardId === undefined)
        for (const group of new Set(unnamed.map((slot) => slot.group))) {
            assertExists(group, 'Unnamed slots belong to a group')
            const slots = unnamed.filter((slot) => slot.group === group)
            const cards = [...group]
            assert(cards.length === slots.length, 'Replayed draft cards do not match the game')
            shuffle(cards, this.random)
            slots.forEach((slot, index) => this.pin(slot, cards[index]))
        }
        return this.dealtFrom.every((deck) => deck.some((slot) => !isBlank(this.cardOf(slot))))
    }

    affordable(state: State): boolean {
        const committed = (playerId: string) =>
            (this.selections.get(playerId) ?? []).reduce(
                (sum, slot) => sum + priceFor(state, this.cardOf(slot)),
                0
            )
        const cash = (playerId: string) => finiteCashOwnedBy(state, { kind: 'player', playerId })
        const [activeId] = state.activePlayerIds
        // A sampled active player must be able to pick something; the final offer can be passed.
        const canChoose =
            activeId === this.viewerId ||
            hiddenDistribution(state).finalOffer !== undefined ||
            (this.packets.get(activeId) ?? []).some(
                (slot) => committed(activeId) + priceFor(state, this.cardOf(slot)) <= cash(activeId)
            )
        return (
            canChoose &&
            state.players.every((player) => committed(player.playerId) <= cash(player.playerId))
        )
    }

    write(state: State): void {
        const draft = hiddenDistribution(state)
        for (const participant of draft.participants) {
            if (participant.playerId === this.viewerId) continue
            participant.packet = (this.packets.get(participant.playerId) ?? []).map((slot) =>
                this.cardOf(slot)
            )
            participant.selections = (this.selections.get(participant.playerId) ?? []).map(
                (slot) => ({ cardId: this.cardOf(slot), price: priceFor(state, this.cardOf(slot)) })
            )
        }
        draft.deck = this.deck.map((slot) => this.cardOf(slot))
    }

    private deal(view: DraftView): boolean {
        const draft = hiddenDistribution(view)
        assert(
            this.deck.length === draft.remainingCount,
            'Replayed deck size disagrees with the draft'
        )
        this.dealtFrom.push([...this.deck])
        const [playerId] = view.activePlayerIds
        const packet = this.deck.splice(0, packetSize(this.playerCount))
        this.packets.set(playerId, packet)
        if (draft.finalOffer && !this.pin(packet[0], draft.finalOffer.cardId)) return false
        if (playerId !== this.viewerId) return true
        const seen = draft.participants.find((participant) => participant.playerId === playerId)
        assertExists(seen?.packet, 'The viewer sees their own packet')
        return this.observe(packet, seen.packet)
    }

    private keep(playerId: string, packet: Slot[], action: GameAction): Slot {
        if (playerId !== this.viewerId) return packet[Math.floor(this.random() * packet.length)]
        assert('cardId' in action, 'The viewer sees their own choices')
        const kept = packet.find((slot) => slot.cardId === action.cardId)
        assertExists(kept, 'The viewer chose from the packet they were shown')
        return kept
    }

    /** The viewer does not see the order of the cards they pass, so those become one group. */
    private returned(playerId: string, packet: Slot[], kept: Slot): Slot[] {
        const returned = packet.filter((slot) => slot !== kept)
        if (playerId !== this.viewerId) {
            shuffle(returned, this.random)
            return returned
        }
        const passed: Group = new Set(returned.map((slot) => this.cardOf(slot)))
        for (const cardId of passed) this.groupOf.set(cardId, passed)
        return returned.map(() => ({ group: passed }))
    }

    /** The dealt slots must hold exactly the packet the viewer saw. */
    private observe(packet: Slot[], seen: readonly string[]): boolean {
        assert(packet.length === seen.length, 'Replayed packet size disagrees with the draft')
        const unseen = seen.filter((cardId) => !packet.some((slot) => slot.cardId === cardId))
        const open = packet.filter((slot) => slot.cardId === undefined)
        if (unseen.length !== open.length) return false
        for (const group of new Set(open.map((slot) => slot.group))) {
            const slots = open.filter((slot) => slot.group === group)
            const cards = unseen.filter((cardId) => this.groupOf.get(cardId) === group)
            if (cards.length !== slots.length) return false
            slots.forEach((slot, index) => this.pin(slot, cards[index]))
        }
        return true
    }

    private pin(slot: Slot, cardId: string): boolean {
        if (slot.cardId !== undefined) return slot.cardId === cardId
        const group = this.groupOf.get(cardId)
        if (group === undefined || group !== slot.group) return false
        group.delete(cardId)
        this.groupOf.delete(cardId)
        slot.cardId = cardId
        delete slot.group
        return true
    }

    private cardOf(slot: Slot): string {
        assertExists(slot.cardId, 'Every replayed card is named')
        return slot.cardId
    }
}
