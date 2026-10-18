<script lang="ts">
    import {
        CASH_PRODUCTION,
        availableProductions,
        baseEffects,
        basesAwaitingProduction,
        producingBases,
        productionYield,
        resolvedAnomaly
    } from '@tabletop/stellar-horizons-2'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import {
        FIELD_COLORS,
        backProductionText,
        plural,
        productionLabel,
        systemName
    } from '$lib/utils/presentation.js'

    const gameSession = getGameSession()
    const gameState = $derived(gameSession.gameState)
    const playerId = $derived(gameSession.myPlayerId ?? '')
    const waiting = $derived(basesAwaitingProduction(gameState, playerId))
    const chosen = $derived(
        producingBases(gameState, playerId).flatMap((base) =>
            base.production === undefined ? [] : [{ base, production: base.production }]
        )
    )

    // A turned-over anomaly in the base's system that changes its production, named with how.
    function backNote(systemId: string): string | undefined {
        const anomaly = resolvedAnomaly(gameState, systemId)
        const text = backProductionText(baseEffects(gameState, systemId))
        return anomaly && text ? `${anomaly.name}: ${text}` : undefined
    }
</script>

<div class="sh-step">
    <p class="hint">
        Each base produces cash or one type of tech marker its system's worlds produce: the best
        value they show for it, plus the bonus for the base's settlements.
    </p>
    {#each waiting as base (base.systemId)}
        <div class="base">
            <span class="system"
                >{systemName(base.systemId)}
                <span class="note">{plural(base.settlements, 'settlement')}</span></span
            >
            {#if backNote(base.systemId)}
                <span class="note">{backNote(base.systemId)}</span>
            {/if}
            <span class="choices">
                {#each availableProductions(gameState, base) as production (production)}
                    <button
                        type="button"
                        style:--accent={production === CASH_PRODUCTION
                            ? '#f2c94c'
                            : FIELD_COLORS[production]}
                        onclick={() => gameSession.chooseProduction(base.systemId, production)}
                        >{productionLabel(
                            production,
                            productionYield(gameState, base, production)
                        )}</button
                    >
                {/each}
            </span>
        </div>
    {/each}
    {#each chosen as { base, production } (base.systemId)}
        <div class="base done">
            <span class="system">{systemName(base.systemId)}</span>
            <span class="note"
                >{productionLabel(production, productionYield(gameState, base, production))}</span
            >
        </div>
    {/each}
</div>

<style>
    .base {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 6px 12px;
    }

    .system {
        min-width: 150px;
        font-weight: 700;
        color: #e8f1ff;
    }

    .note {
        font-size: 12px;
        font-weight: 400;
        color: #8fa4c2;
    }

    .choices {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
    }

    .choices button {
        border-left: 4px solid var(--accent);
    }

    .done .system {
        color: #8fa4c2;
    }
</style>
