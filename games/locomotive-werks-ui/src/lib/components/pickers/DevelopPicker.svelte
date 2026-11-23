<script lang="ts">
    import { Floater } from '@tabletop/frontend-components'
    import { locomotiveData } from '@tabletop/locomotive-werks'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import LocomotiveBadge from '../LocomotiveBadge.svelte'

    const gameSession = getGameSession()

    const chosen = $derived(gameSession.chosenLocomotive)
</script>

{#if chosen}
    {@const cost = locomotiveData(chosen).developmentCost}
    {#key chosen}
        <Floater
            placement="bottom"
            reference="#lw-develop-{chosen}"
            onClose={() => gameSession.closeDevelopPicker()}
        >
            <div class="picker">
                <div class="title"><LocomotiveBadge locomotiveId={chosen} /></div>
                <p>Develop it for ${cost} and open a werk with one unit.</p>
                <button type="button" class="primary" onclick={() => gameSession.develop(chosen)}
                    >Develop · ${cost}</button
                >
            </div>
        </Floater>
    {/key}
{/if}

<style>
    .picker {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 6px;
        max-width: 260px;
        border: 2px solid #232d36;
        border-radius: 12px;
        background: #e9eef2;
        padding: 8px 12px;
        box-shadow: 0 8px 18px rgba(16, 28, 40, 0.3);
        color: #232d36;
        font-family: 'LW Baskerville', Georgia, serif;
        text-align: center;
    }

    p {
        margin: 0;
        font-size: 14px;
    }

    .primary {
        border-radius: 999px;
        background: #25303a;
        padding: 6px 16px;
        font-size: 15px;
        font-weight: 700;
        color: #dbe3ea;
    }
</style>
