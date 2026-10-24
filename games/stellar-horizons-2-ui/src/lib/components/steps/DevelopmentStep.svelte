<script lang="ts">
    import { assertExists } from '@tabletop/common'
    import {
        TECH_FIELDS,
        CardUnavailable,
        cardDefinition,
        cardUnavailability,
        cashAndInfluence,
        endRollModifierChoices,
        influencePoints,
        isCampaign,
        purchaseCost,
        purchaseField,
        techDefinition,
        canAfford,
        type Purchase
    } from '@tabletop/stellar-horizons-2'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { suggestPayment } from '$lib/model/payment.js'
    import { TECH_EFFECT_TEXT } from '$lib/utils/presentation.js'
    import { cardTitle } from '$lib/utils/cards.js'
    import TechMarker from '../TechMarker.svelte'
    import TechMarkerTotal from '../TechMarkerTotal.svelte'
    import CardFace from '../cards/CardFace.svelte'

    const gameSession = getGameSession()
    const gameState = $derived(gameSession.gameState)
    const playerId = $derived(gameSession.myPlayerId ?? '')
    const player = $derived(gameState.getPlayerState(playerId))
    const techId = $derived(gameSession.selectedTech)
    const cardId = $derived(gameSession.selectedCard)

    // A tech from the chart or a card from the hand: both are paid the same way.
    const purchase: Purchase | undefined = $derived(
        techId ? { techId } : cardId ? { cardId } : undefined
    )
    // The tech or card id the payment being drafted is for.
    const purchaseKey = $derived(techId ?? cardId)

    let chosenMarkers: { purchaseKey: string; indexes: number[] } | undefined = $state()
    // Campaign: IP pay 2 points each. Unless the player picks a number, as many are used as
    // the cash on hand cannot cover.
    let chosenInfluence: { purchaseKey: string; influence: number } | undefined = $state()

    const field = $derived(purchase ? purchaseField(purchase) : undefined)
    const cost = $derived(purchase ? purchaseCost(gameState, playerId, purchase) : 0)
    const held = $derived(field ? player.techMarkers[field] : [])
    const selectedIndexes: number[] = $derived.by(() => {
        if (!purchaseKey) return []
        if (chosenMarkers && chosenMarkers.purchaseKey === purchaseKey) return chosenMarkers.indexes
        // IP count towards what can be paid, so markers are still suggested first.
        const suggestion = suggestPayment(
            held,
            cost,
            player.cash + influencePoints(gameState, playerId)
        )
        if (!suggestion) return []
        const remaining = held.map((value, index) => ({ value, index }))
        return suggestion.markers.map((value) => {
            const position = remaining.findIndex((entry) => entry.value === value)
            const [entry] = remaining.splice(position, 1)
            return entry.index
        })
    })
    // Markers are shown, and named on the button, from the highest value down.
    const ordered = $derived(
        held.map((value, index) => ({ value, index })).sort((a, b) => b.value - a.value)
    )
    const paying = $derived(ordered.filter((entry) => selectedIndexes.includes(entry.index)))
    const keeping = $derived(ordered.filter((entry) => !selectedIndexes.includes(entry.index)))
    const markers = $derived(paying.map((entry) => entry.value))
    const payment = $derived(
        purchase && purchaseKey
            ? cashAndInfluence(
                  gameState,
                  playerId,
                  purchase,
                  markers.reduce((total, value) => total + value, 0),
                  chosenInfluence && chosenInfluence.purchaseKey === purchaseKey
                      ? chosenInfluence.influence
                      : undefined
              )
            : { influence: 0, maxInfluence: 0, cash: 0 }
    )
    const influence = $derived(payment.influence)
    const maxInfluence = $derived(payment.maxInfluence)
    const cash = $derived(payment.cash)
    const affordable = $derived(cash <= player.cash)

    // The hand, each card with what it costs now, and why one cannot be bought.
    function unavailableText(id: string, reason: CardUnavailable): string {
        const definition = cardDefinition(id)
        switch (reason) {
            case CardUnavailable.TypeBought:
                return `${definition.field} bought`
            case CardUnavailable.Excluded:
                assertExists(definition.excludes, 'Only a card that excludes another is excluded')
                return `Not with ${cardDefinition(definition.excludes).name}`
            case CardUnavailable.NotHeld:
                return 'Not in hand'
        }
    }
    const hand = $derived(
        player.hand.flatMap((card) => {
            if (card.cardId === undefined) return []
            const id = card.cardId
            const reason = cardUnavailability(gameState, playerId, id)
            const note =
                reason !== undefined
                    ? unavailableText(id, reason)
                    : !canAfford(gameState, playerId, { cardId: id })
                      ? 'Too dear'
                      : undefined
            return [
                {
                    cardId: id,
                    cost: purchaseCost(gameState, playerId, { cardId: id }),
                    note
                }
            ]
        })
    )
    const modifiers = $derived(endRollModifierChoices(gameState, playerId))
    const modifier = $derived(player.endRollModifier ?? 0)

    function adjustInfluence(change: number) {
        if (!purchaseKey) return
        const next = Math.max(0, Math.min(maxInfluence, influence + change))
        chosenInfluence = { purchaseKey, influence: next }
    }

    const payLabel = $derived.by(() => {
        const verb = cardId ? 'Buy' : 'Develop'
        const parts = [
            markers.join('+'),
            influence > 0 ? `${influence} IP` : '',
            cash > 0 ? `$${cash}B` : ''
        ].filter(Boolean)
        return parts.length > 0 ? `${verb} with ${parts.join(' and ')}` : `${verb} for free`
    })

    function toggle(index: number) {
        if (!purchaseKey) return
        const next = selectedIndexes.includes(index)
            ? selectedIndexes.filter((candidate) => candidate !== index)
            : [...selectedIndexes, index]
        chosenMarkers = { purchaseKey, indexes: next }
    }

    async function pay() {
        if (!purchase || !affordable) return
        chosenMarkers = undefined
        chosenInfluence = undefined
        if (techId) {
            await gameSession.developTech(techId, markers, cash, influence)
        } else if (cardId) {
            await gameSession.buyCard(cardId, markers, cash, influence)
        }
    }
</script>

<div class="sh-step">
    {#if purchase && field}
        {#if techId}
            {@const tech = techDefinition(techId)}
            <div class="section-title">{tech.name}</div>
            <p class="hint">
                {TECH_EFFECT_TEXT[tech.id]}. Cost {cost}
                {field.toLowerCase()} points.
            </p>
        {:else if cardId}
            <div class="section-title">{cardTitle(cardId)}</div>
            <p class="hint">
                {cardDefinition(cardId).text}. Cost {cost}
                {field.toLowerCase()} points; it counts as your {field.toLowerCase()} purchase this turn.
            </p>
        {/if}
        <div class="payment">
            <div class="group">
                <span class="label">Pay with</span>
                <span class="chits">
                    {#each paying as marker (marker.index)}
                        <TechMarker
                            {field}
                            value={marker.value}
                            size={40}
                            label="Keep {field.toLowerCase()} {marker.value}"
                            onclick={() => toggle(marker.index)}
                        />
                    {/each}
                    {#if maxInfluence > 0 || influence > 0}
                        <span class="influence-picker" aria-label="IP to spend">
                            <button
                                type="button"
                                aria-label="One IP fewer"
                                disabled={influence === 0}
                                onclick={() => adjustInfluence(-1)}>−</button
                            >
                            <span>{influence} IP</span>
                            <button
                                type="button"
                                aria-label="One IP more"
                                disabled={influence >= maxInfluence}
                                onclick={() => adjustInfluence(1)}>+</button
                            >
                        </span>
                    {/if}
                    {#if cash > 0}
                        <span class="cash" class:short={!affordable}>${cash}B</span>
                    {:else if paying.length === 0}
                        <span class="nothing">Nothing</span>
                    {/if}
                </span>
            </div>
            {#if keeping.length > 0}
                <div class="group keep">
                    <span class="label">Keep</span>
                    <span class="chits">
                        {#each keeping as marker (marker.index)}
                            <TechMarker
                                {field}
                                value={marker.value}
                                size={40}
                                label="Pay with {field.toLowerCase()} {marker.value}"
                                onclick={() => toggle(marker.index)}
                            />
                        {/each}
                    </span>
                </div>
            {/if}
        </div>
        <div class="buttons">
            <button type="button" class="primary" disabled={!affordable} onclick={pay}>
                {payLabel}
            </button>
        </div>
    {:else}
        <dl class="funds" aria-label="Available to spend">
            {#each TECH_FIELDS as field (field)}
                <div class="fund">
                    <dt>{field}</dt>
                    <dd>
                        <TechMarkerTotal {field} values={player.techMarkers[field]} size={36} />
                    </dd>
                </div>
            {/each}
            <div class="fund cash">
                <dt>Cash</dt>
                <dd>${player.cash}B</dd>
            </div>
            {#if isCampaign(gameState)}
                <div class="fund influence">
                    <dt>IP</dt>
                    <dd title="Each IP pays 2 tech points of any type">{player.influence}</dd>
                </div>
            {/if}
        </dl>
        {#if hand.length > 0}
            <div class="hand" aria-label="Your hand">
                {#each hand as card (card.cardId)}
                    <CardFace
                        cardId={card.cardId}
                        cost={card.cost}
                        note={card.note}
                        disabled={card.note !== undefined}
                        onclick={() => gameSession.selectCard(card.cardId)}
                    />
                {/each}
            </div>
        {/if}
        {#if modifiers.length > 0}
            <div
                class="modifier"
                role="group"
                aria-label="Transcend Biology's change to the end roll"
            >
                <span class="label">End roll</span>
                {#each modifiers as amount (amount)}
                    <button
                        type="button"
                        class="chip"
                        class:on={modifier === amount}
                        aria-pressed={modifier === amount}
                        disabled={modifier === amount}
                        onclick={() => gameSession.chooseEndRollModifier(amount)}
                        >{amount === 0 ? 'No change' : `${amount > 0 ? '+' : ''}${amount}%`}</button
                    >
                {/each}
            </div>
        {/if}
        <div class="prompt">
            {hand.length > 0
                ? 'Choose a tech on the chart below, or a card from your hand'
                : 'Choose a tech on the chart below'}
        </div>
    {/if}
</div>

<style>
    .hand {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
    }

    .modifier {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 6px;
    }

    .chip {
        padding: 3px 9px;
        border-radius: 6px;
        border: 1px solid #2f4366;
        font-size: 13px;
    }

    .chip.on {
        border-color: #7fd3ff;
        background: #18324f;
    }

    .modifier .label {
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: #8fa4c2;
    }

    .influence-picker {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-weight: 800;
        color: #d98cf2;
    }

    .influence-picker button {
        width: 24px;
        height: 24px;
        padding: 0;
        border-radius: 5px;
    }

    /* The chits being spent and the chits being kept sit in two labelled groups; clicking a
       chit moves it to the other group. */
    .payment {
        display: flex;
        align-self: flex-start;
        max-width: 100%;
        box-sizing: border-box;
        padding: 8px 14px;
        border: 1px solid #22314d;
        border-radius: 8px;
        background: #070a12;
    }

    .group {
        display: flex;
        flex-direction: column;
        gap: 5px;
    }

    .group.keep {
        margin-left: 18px;
        padding-left: 18px;
        border-left: 1px solid #22314d;
    }

    .group .label {
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: #8fa4c2;
    }

    .chits {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 6px;
        min-height: 40px;
    }

    .group.keep .chits {
        opacity: 0.6;
    }

    .payment .cash {
        padding: 0 4px;
        font-size: 22px;
        font-weight: 700;
        color: #f2c94c;
    }

    .payment .cash.short {
        color: #ff8a7a;
    }

    .nothing {
        font-size: 13px;
        color: #6f84a3;
    }

    /* What the player can spend, in its own darker panel like the other steps' tables: the
       total of their markers in each field, then their cash. */
    .funds {
        display: flex;
        align-self: flex-start;
        gap: 18px;
        margin: 0;
        padding: 8px 14px;
        border: 1px solid #22314d;
        border-radius: 8px;
        background: #070a12;
    }

    .fund {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 5px;
    }

    .fund dt {
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: #8fa4c2;
    }

    .fund dd {
        display: flex;
        align-items: center;
        min-height: 36px;
        margin: 0;
    }

    .fund.cash {
        padding-left: 18px;
        border-left: 1px solid #22314d;
    }

    .fund.cash dd {
        font-size: 22px;
        font-weight: 700;
        color: #f2c94c;
    }

    .fund.influence dd {
        font-size: 22px;
        font-weight: 700;
        color: #d98cf2;
    }

    @media (max-width: 639px) {
        .funds {
            align-self: stretch;
            justify-content: space-between;
            gap: 8px;
            padding: 8px 10px;
        }

        .fund.cash {
            padding-left: 10px;
        }

        .fund dt {
            font-size: 10px;
            letter-spacing: 0.04em;
        }

        .fund.cash dd,
        .fund.influence dd {
            font-size: 18px;
        }
    }
</style>
