<script lang="ts">
    import { RESOURCES, totalResources, Resource } from '@tabletop/power-grid'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import PlantCard from '../PlantCard.svelte'
    import ResourceTally from './ResourceTally.svelte'

    const session = getGameSession()
    const returned = $derived(session.scrapReturned)
    const splitChoice = $derived(
        returned !== undefined &&
            session.myPlayerState !== undefined &&
            (returned.coal > 0 || returned.oil > 0) &&
            session.myPlayerState.resources.coal > 0 &&
            session.myPlayerState.resources.oil > 0
    )
</script>

<div class="column">
    <p class="prompt">
        You may own only three power plants. Choose one of your older plants to scrap.
    </p>
    <div class="cards">
        {#each session.scrappablePlants as plant (plant)}
            <PlantCard
                {plant}
                size={72}
                targetable={session.scrapChoice !== plant}
                selected={session.scrapChoice === plant}
                onclick={() => session.chooseScrap(plant)}
            />
        {/each}
    </div>
    {#if session.scrapChoice !== undefined && returned}
        <div class="controls">
            {#if totalResources(returned) > 0}
                <span class="note">
                    Your other plants cannot hold <ResourceTally amounts={returned} />; they go back
                    to the supply.
                </span>
                {#if splitChoice}
                    <button
                        type="button"
                        class="btn secondary"
                        onclick={() => session.toggleDropOil()}
                    >
                        Keep {session.dropOilFirst ? 'coal' : 'oil'} instead
                    </button>
                {/if}
            {/if}
            <button type="button" class="btn primary" onclick={() => session.confirmScrap()}>
                Scrap plant {session.scrapChoice}
            </button>
        </div>
    {/if}
</div>
