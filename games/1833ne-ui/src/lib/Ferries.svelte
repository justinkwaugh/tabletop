<script lang="ts">
    import { FerryPrice } from '@tabletop/1833ne'
    import { ConstructionPrompt } from '@tabletop/18xx-ui'
    import { FerryArt, LuxuryFerryArt } from './ferryArt.js'
    import type { FerryOffer, Session1833NE } from './session.svelte.js'
    let { session }: { session: Session1833NE } = $props()
    const money = $derived(session.presentation.money)
    const luxuryPrompt = 'Luxury Ferry Service: double one ferry'
</script>

{#snippet choices(
    offers: readonly FerryOffer[],
    art: Readonly<Record<string, string>>,
    label: (ferry: FerryOffer) => string,
    choose: (locationId: string) => Promise<void>
)}
    <div class="choices">
        {#each offers as ferry (ferry.locationId)}
            <button
                class="ferry"
                disabled={!session.canChooseAction}
                aria-label={label(ferry)}
                title={label(ferry)}
                onclick={() => choose(ferry.locationId)}
                ><img src={art[ferry.locationId]} alt="" /></button
            >
        {/each}
    </div>
{/snippet}

<section class="ferries centered-panel" aria-label="Ferries">
    {#if session.ferryOffers.length}
        <ConstructionPrompt {session} prompt={`Buy a ferry for ${money(FerryPrice)}`} />
        {@render choices(
            session.ferryOffers,
            FerryArt,
            (ferry) => `${ferry.name} ferry, ${money(ferry.value)} on its routes`,
            (locationId) => session.buyFerry(locationId)
        )}
    {/if}
    {#if session.luxuryOffers.length}
        {#if session.ferryOffers.length}<header>{luxuryPrompt}</header>
        {:else}<ConstructionPrompt {session} prompt={luxuryPrompt} />{/if}
        {@render choices(
            session.luxuryOffers,
            LuxuryFerryArt,
            (ferry) => `Double the ${ferry.name} ferry`,
            (locationId) => session.assignLuxuryFerry(locationId)
        )}
    {/if}
</section>

<style>
    .ferries {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 14px;
    }
    .choices {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 12px;
    }
    button.ferry {
        padding: 0;
        border: 0;
        border-radius: 999px;
        background: transparent;
        cursor: pointer;
    }
    button.ferry:disabled {
        opacity: 0.45;
        cursor: default;
    }
    button.ferry:focus-visible {
        outline: 2px solid #a87948;
        outline-offset: 3px;
    }
    img {
        display: block;
        width: 56px;
        height: 56px;
    }
</style>
