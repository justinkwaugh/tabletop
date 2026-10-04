<script lang="ts">
    import {
        TECH_FIELDS,
        techCost,
        techDefinition,
        type TechId
    } from '@tabletop/stellar-horizons-2'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { cashNeeded, suggestPayment } from '$lib/model/payment.js'
    import { TECH_EFFECT_TEXT } from '$lib/utils/presentation.js'
    import TechMarker from '../TechMarker.svelte'

    const gameSession = getGameSession()
    const gameState = $derived(gameSession.gameState)
    const playerId = $derived(gameSession.myPlayerId ?? '')
    const player = $derived(gameState.getPlayerState(playerId))
    const techId = $derived(gameSession.selectedTech)

    let chosen: { techId: TechId; indexes: number[] } | undefined = $state()

    const tech = $derived(techId ? techDefinition(techId) : undefined)
    const cost = $derived(techId ? techCost(gameState, playerId, techId) : 0)
    const held = $derived(tech ? player.techMarkers[tech.field] : [])
    const selectedIndexes: number[] = $derived.by(() => {
        if (!techId) return []
        if (chosen && chosen.techId === techId) return chosen.indexes
        const suggestion = suggestPayment(held, cost, player.cash)
        if (!suggestion) return []
        const remaining = held.map((value, index) => ({ value, index }))
        return suggestion.markers.map((value) => {
            const position = remaining.findIndex((entry) => entry.value === value)
            const [entry] = remaining.splice(position, 1)
            return entry.index
        })
    })
    const markers = $derived(selectedIndexes.map((index) => held[index]))
    const cash = $derived(cashNeeded(markers, cost))
    const affordable = $derived(cash <= player.cash)
    const developed = $derived(player.fieldsDeveloped)

    const paymentLabel = $derived(
        [markers.length > 0 ? `markers ${markers.join('+')}` : '', cash > 0 ? `$${cash}B` : '']
            .filter(Boolean)
            .join(' and ') || 'free'
    )

    function toggle(index: number) {
        if (!techId) return
        const next = selectedIndexes.includes(index)
            ? selectedIndexes.filter((candidate) => candidate !== index)
            : [...selectedIndexes, index]
        chosen = { techId, indexes: next }
    }

    async function develop() {
        if (!techId || !affordable) return
        chosen = undefined
        await gameSession.developTech(techId, markers, cash)
    }
</script>

<div class="sh-step">
    {#if tech}
        <div class="section-title">{tech.name}</div>
        <p class="hint">
            {TECH_EFFECT_TEXT[tech.id]}. Cost {cost}
            {tech.field.toLowerCase()} points.
        </p>
        <div class="markers">
            {#each held as value, index (index)}
                <TechMarker
                    field={tech.field}
                    {value}
                    dimmed={!selectedIndexes.includes(index)}
                    onclick={() => toggle(index)}
                />
            {:else}
                <span class="hint">No {tech.field.toLowerCase()} markers.</span>
            {/each}
        </div>
        <div class="buttons">
            <button type="button" class="primary" disabled={!affordable} onclick={develop}>
                Develop for {paymentLabel}
            </button>
            <button type="button" onclick={() => gameSession.clearSelection()}>Cancel</button>
        </div>
    {:else}
        <p class="hint">
            Choose a highlighted tech on the chart. You may develop one tech of each type per turn;
            prerequisites must have been owned since the start of the turn. Cash pays $1B per point.
        </p>
        <div class="fields">
            {#each TECH_FIELDS as field (field)}
                <span class:spent={developed.includes(field)}>
                    {field}: {developed.includes(field) ? 'developed this turn' : 'available'}
                </span>
            {/each}
        </div>
    {/if}
</div>

<style>
    .markers {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
    }

    .fields {
        display: flex;
        gap: 12px;
        font-size: 13px;
        color: #b7c7de;
    }

    .fields .spent {
        color: #5c6f8e;
    }
</style>
