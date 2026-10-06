<script lang="ts">
    import { getCompany, stockMarketSpace } from '@tabletop/18xx'
    import type { EighteenXXSessionView } from '../session/eighteenXXSession.svelte.js'
    import { marketColors } from './marketColors.js'
    let { session }: { session: EighteenXXSessionView } = $props()
    const pending = $derived(session.gameState.pendingPar)
</script>

{#if pending}
    {@const company = getCompany(session.gameState, pending.companyId)}
    <section aria-label="Set par">
        <p>
            {session.ownerName({ kind: 'player', playerId: pending.playerId })} sets {company.name}’s
            par.
        </p>
        {#if session.stock.canPar}
            <div class="choices" aria-label="Par prices">
                {#each session.stock.parSpaceIds as spaceId (spaceId)}
                    {@const space = stockMarketSpace(session.gameState.stockMarket, spaceId)}
                    <button
                        class="par-choice"
                        disabled={session.busy}
                        style:background={marketColors[space.color] ?? space.color}
                        data-par-price={space.price}
                        onclick={() => session.stock.parCompany(spaceId)}>{space.price}</button
                    >
                {/each}
            </div>
        {/if}
    </section>
{/if}

<style>
    section {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 6px;
        padding: 4px 0;
        color: var(--rail-text, #514536);
        font-size: 13px;
    }
    p {
        margin: 8px 0 0;
    }
    .choices {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 6px;
    }
    .par-choice {
        min-width: 48px;
        padding: 6px 10px;
        border: 1px solid #94a3b8;
        border-radius: 0.3rem;
        color: #2c2418;
        font-weight: 600;
    }
    .par-choice:disabled {
        opacity: 0.4;
    }
</style>
