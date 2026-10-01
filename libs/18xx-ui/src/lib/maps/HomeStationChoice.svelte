<script lang="ts">
    import type { EighteenXXSession } from '../session/eighteenXXSession.svelte.js'
    let { session }: { session: EighteenXXSession } = $props()
    const choice = $derived(session.stations.homeChoice)
    const location = (id: string) => session.mapView.map.location(id)
    const company = $derived(
        session.gameState.companies.find((company) => company.id === choice?.companyId)
    )
</script>

{#if choice}
    <section aria-label="Home city choice">
        <p>
            {company?.name ?? choice.companyId} chooses its home city
        </p>
        <div class="choices">
            {#each choice.positions as position, index (`${position.locationId}/${position.nodeId}`)}
                <button
                    data-home-node={position.nodeId}
                    onclick={() => session.stations.chooseHome(position)}
                    disabled={!session.stations.canChooseHome || session.busy}
                >
                    {location(position.locationId).name ?? position.locationId} · city {index + 1}
                </button>
            {/each}
        </div>
    </section>
{/if}

<style>
    section {
        padding: 4px 0;
        color: var(--rail-text, #514536);
        font-size: 13px;
        text-align: center;
    }
    .choices {
        display: flex;
        gap: 10px;
        justify-content: center;
        flex-wrap: wrap;
    }
    button {
        font: inherit;
        padding: 7px 12px;
        border: 1px solid var(--rail-border, #c7b8a6);
        border-radius: 4px;
        background: var(--rail-surface, #fffdf8);
        cursor: pointer;
    }
    button:hover:not(:disabled) {
        background: var(--rail-surface-raised, #efe7db);
    }
    button:focus-visible {
        outline: 2px solid #a87948;
        outline-offset: 2px;
    }
    button:disabled {
        opacity: 0.45;
        cursor: default;
    }
    p {
        margin: 8px 0;
    }
</style>
