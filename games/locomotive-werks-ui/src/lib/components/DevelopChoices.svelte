<script lang="ts">
    import { locomotiveData } from '@tabletop/locomotive-werks'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { locomotiveName } from '$lib/utils/locomotives.js'
    import LocomotiveBadge from './LocomotiveBadge.svelte'

    // The locomotives the player can afford to develop. A press chooses one, and Develop below
    // confirms it, since a development rolls a die and cannot be undone.
    const gameSession = getGameSession()
</script>

<div class="choices" role="group" aria-label="Locomotives you can develop">
    {#each gameSession.developTargets as locomotiveId (locomotiveId)}
        {@const cost = locomotiveData(locomotiveId).developmentCost}
        <button
            type="button"
            class="choice"
            aria-pressed={gameSession.chosenLocomotive === locomotiveId}
            onclick={() => gameSession.chooseLocomotive(locomotiveId)}
            aria-label="Develop {locomotiveName(locomotiveId)} for ${cost}"
            ><LocomotiveBadge {locomotiveId} /> ${cost}</button
        >
    {/each}
</div>

<style>
    .choices {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 6px;
        max-width: 640px;
    }

    .choice {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        min-height: 34px;
        border: 1.5px solid #232d36;
        border-radius: 999px;
        padding: 2px 12px 2px 6px;
        font-size: 15px;
        font-weight: 700;
        white-space: nowrap;
    }

    .choice:hover {
        background: rgba(35, 45, 54, 0.1);
    }

    .choice[aria-pressed='true'] {
        border-color: #d39a12;
        background: rgba(242, 193, 78, 0.45);
        box-shadow: 0 0 0 2px #d39a12;
    }
</style>
