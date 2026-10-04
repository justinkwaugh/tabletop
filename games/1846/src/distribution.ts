import { assert, assertExists, shuffle } from '@tabletop/common'
import { settleCashPayments, getCompany, finiteCashOwnedBy } from '@tabletop/18xx'
import { draftCompany, isBlank } from './catalog.js'
import type { HydratedEighteenFortySixState } from './state.js'

type State = HydratedEighteenFortySixState
export function participant(state: State, playerId: string) {
    const participant = state.draft.participants.find(
        (candidate) => candidate.playerId === playerId
    )
    assertExists(participant, 'Unknown draft participant')
    return participant
}
export function priceFor(state: State, cardId: string): number {
    if (isBlank(cardId)) return 0
    if (state.draft.finalOffer?.cardId === cardId) return state.draft.finalOffer.price
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
    const deck = state.draft.deck
    assertExists(deck, 'Dealing requires the hidden deck')
    state.draft.remainingCount = deck.length
    delete state.draft.finalOffer
    if (deck.every(isBlank)) {
        state.machineState = 'RevealingDraft'
        return
    }
    const buyer = participant(state, state.activePlayerIds[0])
    assert(buyer.packet?.length === 0, 'Previous packet must be returned before dealing')
    buyer.packet = deck.splice(0, state.numPlayers + 2)
    if (state.draft.remainingCount === 1) {
        const cardId = buyer.packet[0]
        state.draft.finalOffer = { cardId, price: priceFor(state, cardId) }
    }
}
function nextPlayer(state: State): void {
    state.turnManager.endTurn(state.actionCount)
    state.activePlayerIds = [state.turnManager.startNextTurn(state.actionCount)]
}
export function chooseCard(state: State, playerId: string, cardId: string): void {
    assert(
        choicesFor(state, playerId).includes(cardId),
        'Card is not an available, affordable choice'
    )
    const buyer = participant(state, playerId)
    assertExists(buyer.packet, 'Selecting requires a known packet')
    assertExists(buyer.selections, 'Selecting requires known commitments')
    assertExists(state.draft.deck, 'Selecting requires the hidden deck')
    buyer.selections.push({ cardId, price: priceFor(state, cardId) })
    const returned = buyer.packet.filter((id) => id !== cardId)
    shuffle(returned, state.getProtectedPrng().random)
    state.draft.deck.push(...returned)
    buyer.packet = []
    nextPlayer(state)
    dealPacket(state)
}
export function passFinalCompany(state: State, playerId: string): void {
    assert(
        state.machineState === 'Drafting' && state.isActivePlayer(playerId),
        'Not your draft turn'
    )
    const offer = state.draft.finalOffer
    assertExists(offer, 'Passing requires a lone final company')
    const company = draftCompany(offer.cardId)
    assert(offer.price > company.debt, 'The final company must be taken at its debt floor')
    participant(state, playerId).packet = []
    offer.price -= 10
    nextPlayer(state)
    const buyer = participant(state, state.activePlayerIds[0])
    buyer.packet = [offer.cardId]
    if (offer.price === company.debt) chooseCard(state, buyer.playerId, offer.cardId)
}
export function settleDistribution(state: State): void {
    assert(state.machineState === 'RevealingDraft', 'Distribution is not ready to reveal')
    for (const buyer of state.draft.participants) {
        assertExists(buyer.selections, 'Revealing requires all selections')
        for (const selection of buyer.selections) {
            if (isBlank(selection.cardId)) continue
            const company = draftCompany(selection.cardId)
            const certificate = state.certificates.find(
                (certificate) => certificate.id === `${company.id}:charter`
            )
            assert(
                certificate && !certificate.retired && certificate.owner.kind === 'bank',
                'Draft certificate must be bank owned'
            )
            certificate.owner = { kind: 'player', playerId: buyer.playerId }
            if (selection.price > 0)
                settleCashPayments(state, [
                    { from: certificate.owner, to: { kind: 'bank' }, amount: selection.price }
                ])
            state.purchases.push({ ...selection, playerId: buyer.playerId })
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
                state.stationReservations = state.stationReservations.filter(
                    (reservation) => reservation.companyId !== company.id
                )
                state.stations.push({
                    id: `${company.id}:station:1`,
                    companyId: company.id,
                    status: 'placed',
                    position: { locationId: company.home, nodeId: 'city', slot: 0 }
                })
                state.trainInventory.trains.push({
                    id: `${company.id}:2`,
                    definitionId: '2',
                    status: 'owned',
                    owner: { kind: 'company', companyId: company.id }
                })
            }
        }
        buyer.packet = []
        buyer.selections = []
    }
    state.draft.deck = []
    state.draft.remainingCount = 0
    delete state.draft.finalOffer
    state.turnManager.endTurn(state.actionCount)
    state.turnManager.turnOrder = state.players.map((player) => player.playerId)
    state.activePlayerIds = [state.priorityDealPlayerId]
    state.turnManager.startTurn(state.priorityDealPlayerId, state.actionCount + 1)
    state.machineState = 'StockRound'
}
