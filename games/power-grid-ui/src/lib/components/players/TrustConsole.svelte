<script lang="ts">
    import { TRUST_HOUSES } from '@tabletop/power-grid'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { TRUST_COLOR } from '$lib/model/session.svelte.js'
    import PlantCard from '../PlantCard.svelte'
    import House from '../House.svelte'

    const session = getGameSession()
    const trust = $derived(session.gameState.trust)
</script>

{#if trust}
    <article class="console">
        <header>
            <span class="position" title="The Trust is always second">2</span>
            <span class="name">The Trust</span>
        </header>
        <div class="tray">
            <div class="readouts">
                <div class="stat" title="Houses the Trust still has to block cities with">
                    <svg width="18" height="18" viewBox="-9 -9 18 18" aria-hidden="true">
                        <House x={0} y={0} color={TRUST_COLOR} size={1.1} />
                    </svg>
                    <span class="value">{trust.housesLeft}</span>
                    <span class="label">of {TRUST_HOUSES} houses left</span>
                </div>
            </div>
            <div class="plants">
                {#each trust.plants as plant (plant)}
                    <PlantCard {plant} size={58} />
                {:else}
                    <span class="empty">Takes the biggest plant once a round</span>
                {/each}
            </div>
        </div>
    </article>
{/if}

<style>
    .console {
        border-radius: 9px;
        background: #5f7283;
        padding: 0 5px 5px;
        box-shadow: 0 2px 4px rgb(0 0 0 / 0.4);
    }
    header {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 4px 4px 3px;
        color: #ffffff;
    }
    .position {
        font-family: 'Big Shoulders Stencil Display', sans-serif;
        font-weight: 800;
        font-size: 18px;
        width: 24px;
        height: 24px;
        border-radius: 50%;
        background: #1b201b;
        color: #ecebe1;
        display: grid;
        place-items: center;
    }
    .name {
        font-family: 'Big Shoulders Stencil Display', sans-serif;
        font-weight: 800;
        font-size: 21px;
        letter-spacing: 0.03em;
    }
    .tray {
        background: #1b201b;
        border-radius: 6px;
        padding: 8px;
        display: flex;
        flex-direction: column;
        gap: 8px;
    }
    .stat {
        display: flex;
        align-items: center;
        gap: 4px;
    }
    .value {
        font-family: 'Big Shoulders Stencil Display', sans-serif;
        font-weight: 800;
        font-size: 22px;
    }
    .label {
        font-size: 13px;
        color: #aab198;
        text-transform: uppercase;
        letter-spacing: 0.05em;
    }
    .plants {
        display: flex;
        gap: 8px;
        align-items: center;
    }
    .empty {
        color: #8d987a;
        font-size: 14px;
    }
</style>
