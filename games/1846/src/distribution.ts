import { assert, assertExists, shuffle } from '@tabletop/common'
import { settleCashPayments, getCompany, finiteCashOwnedBy } from '@tabletop/18xx'
import { draftCompany, isBlank } from './catalog.js'
import type { EighteenFortySixProjectedState, HydratedEighteenFortySixState } from './state.js'

type State = HydratedEighteenFortySixState
export function hiddenDistribution(state: Pick<EighteenFortySixProjectedState, 'draft'>) {
    assert(state.draft.kind === 'hidden', 'This distribution uses private packets')
    return state.draft
}
export function participant(state: State, playerId: string) {
    const participant = hiddenDistribution(state).participants.find(
        (candidate) => candidate.playerId === playerId
    )
    assertExists(participant, 'Unknown draft participant')
    return participant
}
export function priceFor(state: State, cardId: string): number {
    if (isBlank(cardId)) return 0
    const offer = 'finalOffer' in state.draft ? state.draft.finalOffer : undefined
    if (offer?.cardId === cardId) return offer.price
    const company = draftCompany(cardId)
    return company.price + company.debt
}
export function choicesFor(state: State, playerId: string): string[] {
    if (state.machineState !== 'Drafting' || !state.isActivePlayer(playerId)) return []
    const buyer = participant(state, playerId)
    if (!buyer.packet || !buyer.selections) return []
    const committed = buyer.selections.reduce((sum, selection) => sum + selection.price, 0)
    const cash = finiteCashOwnedBy(state, { kind: 'player', playerId })
    return buyer.packet.filter((cardId) => committed + priceFor(state, cardId) <= cash)
}

/** Moves cards between the hidden queue and the active player's private packet. */
export function dealPacket(state: State): void {
    const draft = hiddenDistribution(state)
    const deck = draft.deck
    assertExists(deck, 'Dealing requires the hidden deck')
    draft.remainingCount = deck.length
    delete draft.finalOffer
    if (deck.every(isBlank)) {
        state.machineState = 'RevealingDraft'
        return
    }
    const buyer = participant(state, state.activePlayerIds[0])
    assert(buyer.packet?.length === 0, 'Previous packet must be returned before dealing')
    buyer.packet = deck.splice(0, state.numPlayers + 2)
    if (draft.remainingCount === 1) {
        const cardId = buyer.packet[0]
        draft.finalOffer = { cardId, price: priceFor(state, cardId) }
    }
}
export function nextDistributionPlayer(state: State): void {
    state.turnManager.endTurn(state.actionCount)
    state.activePlayerIds = [state.turnManager.startNextTurn(state.actionCount)]
}
export function chooseCard(state: State, playerId: string, cardId: string): void {
    const draft = hiddenDistribution(state)
    assert(
        choicesFor(state, playerId).includes(cardId),
        'Card is not an available, affordable choice'
    )
    const buyer = participant(state, playerId)
    assertExists(buyer.packet, 'Selecting requires a known packet')
    assertExists(buyer.selections, 'Selecting requires known commitments')
    assertExists(draft.deck, 'Selecting requires the hidden deck')
    buyer.selections.push({ cardId, price: priceFor(state, cardId) })
    const returned = buyer.packet.filter((id) => id !== cardId)
    shuffle(returned, state.getProtectedPrng().random)
    draft.deck.push(...returned)
    buyer.packet = []
    nextDistributionPlayer(state)
    dealPacket(state)
}
export function passFinalCompany(state: State, playerId: string): void {
    const draft = hiddenDistribution(state)
    assert(
        state.machineState === 'Drafting' && state.isActivePlayer(playerId),
        'Not your draft turn'
    )
    const offer = draft.finalOffer
    assertExists(offer, 'Passing requires a lone final company')
    const company = draftCompany(offer.cardId)
    assert(offer.price > company.debt, 'The final company must be taken at its debt floor')
    participant(state, playerId).packet = []
    offer.price -= 10
    nextDistributionPlayer(state)
    const buyer = participant(state, state.activePlayerIds[0])
    buyer.packet = [offer.cardId]
    if (offer.price === company.debt) chooseCard(state, buyer.playerId, offer.cardId)
}
export function settleDistribution(state: State): void {
    const draft = hiddenDistribution(state)
    assert(state.machineState === 'RevealingDraft', 'Distribution is not ready to reveal')
    for (const buyer of draft.participants) {
        assertExists(buyer.selections, 'Revealing requires all selections')
        for (const selection of buyer.selections) {
            if (isBlank(selection.cardId)) continue
            purchaseOpeningCompany(state, buyer.playerId, selection)
        }
        buyer.packet = []
        buyer.selections = []
    }
    draft.deck = []
    draft.remainingCount = 0
    delete draft.finalOffer
    state.turnManager.endTurn(state.actionCount)
    state.turnManager.turnOrder = state.players.map((player) => player.playerId)
    state.activePlayerIds = [state.priorityDealPlayerId]
    state.turnManager.startTurn(state.priorityDealPlayerId, state.actionCount + 1)
    state.machineState = 'StockRound'
}

export function purchaseOpeningCompany(
    state: State,
    playerId: string,
    selection: Pick<EighteenFortySixProjectedState['purchases'][number], 'cardId' | 'price'>
): void {
    const company = draftCompany(selection.cardId)
    const certificate = state.certificates.find(
        (certificate) => certificate.id === `${company.id}:charter`
    )
    assert(
        certificate && !certificate.retired && certificate.owner.kind === 'bank',
        'Draft certificate must be bank owned'
    )
    certificate.owner = { kind: 'player', playerId }
    if (selection.price > 0)
        settleCashPayments(state, [
            { from: certificate.owner, to: { kind: 'bank' }, amount: selection.price }
        ])
    state.purchases.push({ ...selection, playerId })
    if (company.kind === 'independent') {
        const independent = getCompany(state, company.id)
        independent.president = certificate.owner
        independent.started = true
        independent.floated = true
        independent.funded = true
        settleCashPayments(state, [
            {
                from: { kind: 'bank' },
                to: { kind: 'company', companyId: company.id },
                amount: company.price
            }
        ])
        state.trainInventory.trains.push({
            id: `${company.id}:2`,
            definitionId: '2',
            status: 'owned',
            owner: { kind: 'company', companyId: company.id }
        })
    }
}
