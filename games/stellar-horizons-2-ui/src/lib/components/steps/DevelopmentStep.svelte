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
    import TechMarkerTotal from '../TechMarkerTotal.svelte'

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
    // Markers are shown, and named on the button, from the highest value down.
    const ordered = $derived(
        held.map((value, index) => ({ value, index })).sort((a, b) => b.value - a.value)
    )
    const paying = $derived(ordered.filter((entry) => selectedIndexes.includes(entry.index)))
    const keeping = $derived(ordered.filter((entry) => !selectedIndexes.includes(entry.index)))
    const markers = $derived(paying.map((entry) => entry.value))
    const cash = $derived(cashNeeded(markers, cost))
    const affordable = $derived(cash <= player.cash)

    const developLabel = $derived.by(() => {
        const parts = [markers.join('+'), cash > 0 ? `$${cash}B` : ''].filter(Boolean)
        return parts.length > 0 ? `Develop with ${parts.join(' and ')}` : 'Develop for free'
    })

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
        <div class="payment">
            <div class="group">
                <span class="label">Pay with</span>
                <span class="chits">
                    {#each paying as marker (marker.index)}
                        <TechMarker
                            field={tech.field}
                            value={marker.value}
                            size={40}
                            label="Keep {tech.field.toLowerCase()} {marker.value}"
                            onclick={() => toggle(marker.index)}
                        />
                    {/each}
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
                                field={tech.field}
                                value={marker.value}
                                size={40}
                                label="Pay with {tech.field.toLowerCase()} {marker.value}"
                                onclick={() => toggle(marker.index)}
                            />
                        {/each}
                    </span>
                </div>
            {/if}
        </div>
        <div class="buttons">
            <button type="button" class="primary" disabled={!affordable} onclick={develop}>
                {developLabel}
            </button>
            <button type="button" onclick={() => gameSession.clearSelection()}>Cancel</button>
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
        </dl>
        <div class="prompt">Choose a tech on the chart below</div>
    {/if}
</div>

<style>
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

        .fund.cash dd {
            font-size: 18px;
        }
    }
</style>
