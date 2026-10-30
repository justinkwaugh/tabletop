<script lang="ts">
    import type { Session1833NE } from './session.svelte.js'
    let { session }: { session: Session1833NE } = $props()
    const money = $derived(session.presentation.money)
</script>

{#if session.ferryOffers.length || session.luxuryOffers.length}
    <section class="ferries" aria-label="Ferries">
        {#if session.ferryOffers.length}
            <h3>Buy a ferry for {money(40)}</h3>
            <div class="choices">
                {#each session.ferryOffers as ferry (ferry.locationId)}
                    <button
                        disabled={!session.canChooseAction}
                        onclick={() => session.buyFerry(ferry.locationId)}
                        >{ferry.name} <span>+{money(ferry.value)}</span></button
                    >
                {/each}
            </div>
        {/if}
        {#if session.luxuryOffers.length}
            <h3>Luxury Ferry Service: double one ferry</h3>
            <div class="choices">
                {#each session.luxuryOffers as ferry (ferry.locationId)}
                    <button
                        disabled={!session.canChooseAction}
                        onclick={() => session.assignLuxuryFerry(ferry.locationId)}
                        >{ferry.name}</button
                    >
                {/each}
            </div>
        {/if}
    </section>
{/if}

<style>
    .ferries {
        display: flex;
        flex-direction: column;
        gap: 0.4rem;
        padding: 0.5rem 0.75rem;
    }
    h3 {
        font-weight: 600;
        font-size: 0.9rem;
    }
    .choices {
        display: flex;
        flex-wrap: wrap;
        gap: 0.4rem;
    }
    button {
        border: 1px solid currentColor;
        border-radius: 0.375rem;
        padding: 0.2rem 0.6rem;
    }
    button span {
        opacity: 0.75;
    }
</style>
