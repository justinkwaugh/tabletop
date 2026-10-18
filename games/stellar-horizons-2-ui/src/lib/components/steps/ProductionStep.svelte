<script lang="ts">
    import {
        CASH_PRODUCTION,
        TECH_FIELDS,
        basesAwaitingProduction,
        producingBases,
        productionYield,
        type Production
    } from '@tabletop/stellar-horizons-2'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { FIELD_COLORS, plural, systemName } from '$lib/utils/presentation.js'

    const gameSession = getGameSession()
    const gameState = $derived(gameSession.gameState)
    const playerId = $derived(gameSession.myPlayerId ?? '')
    const waiting = $derived(basesAwaitingProduction(gameState, playerId))
    const chosen = $derived(
        producingBases(gameState, playerId).filter((base) => base.production !== undefined)
    )
    const PRODUCTS: readonly Production[] = [CASH_PRODUCTION, ...TECH_FIELDS]

    function label(production: Production, amount: number): string {
        return production === CASH_PRODUCTION
            ? `$${amount}B`
            : `${plural(amount, `${production.toLowerCase()} marker`)}`
    }
</script>

<div class="sh-step">
    <p class="hint">
        Each base produces cash or one type of tech marker: the best value its system's worlds show
        for it, plus the bonus for the base's settlements.
    </p>
    {#each waiting as base (base.systemId)}
        <div class="base">
            <span class="system"
                >{systemName(base.systemId)}
                <span class="note">{plural(base.settlements, 'settlement')}</span></span
            >
            <span class="choices">
                {#each PRODUCTS as production (production)}
                    {@const amount = productionYield(gameState, base, production)}
                    {#if amount > 0 || production === CASH_PRODUCTION}
                        <button
                            type="button"
                            style:--accent={production === CASH_PRODUCTION
                                ? '#f2c94c'
                                : FIELD_COLORS[production]}
                            onclick={() => gameSession.chooseProduction(base.systemId, production)}
                            >{label(production, amount)}</button
                        >
                    {/if}
                {/each}
            </span>
        </div>
    {/each}
    {#each chosen as base (base.systemId)}
        {#if base.production}
            <div class="base done">
                <span class="system">{systemName(base.systemId)}</span>
                <span class="note"
                    >{label(
                        base.production,
                        productionYield(gameState, base, base.production)
                    )}</span
                >
            </div>
        {/if}
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
