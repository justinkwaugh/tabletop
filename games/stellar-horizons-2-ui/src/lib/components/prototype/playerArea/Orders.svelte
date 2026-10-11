<script lang="ts">
    // PROTOTYPE: directives, the faction's directive goal, titles and kept exploration markers.
    import type { MockFaction } from './campaignMock.svelte.js'
    import Coin from './Coin.svelte'

    let { faction }: { faction: MockFaction } = $props()
    const done = $derived(faction.fulfilled.length)
</script>

<div class="orders">
    {#if faction.directive}
        <div class="directive current" title="Your current directive; hidden from other players">
            <span class="type">{faction.directive.type}</span>
            <span class="text">{faction.directive.text}</span>
            <Coin value={faction.directive.vp} size={20} />
        </div>
    {/if}
    <div class="goal">
        <span class="dots">
            {#each { length: faction.goal.need } as _, index (index)}
                <span class="dot" class:filled={index < done}></span>
            {/each}
        </span>
        <span class="goal-text">{done} of {faction.goal.need} {faction.goal.types} directives</span>
    </div>
    {#each faction.titles as title (title.name)}
        <div class="title" title={title.effect}>
            <span class="laurel">{title.name}</span>
            <Coin value={title.vp} size={20} />
        </div>
    {/each}
    {#if faction.keptMarkers > 0}
        <div class="kept">{faction.keptMarkers} exploration markers kept from last surveys</div>
    {/if}
</div>

<style>
    .orders {
        display: flex;
        flex-direction: column;
        gap: 5px;
    }
    .directive {
        display: grid;
        grid-template-columns: auto 1fr auto;
        align-items: center;
        gap: 6px;
        padding: 5px 7px;
        border-radius: 6px;
        background: #0b0f18;
        border: 1px solid #b08a3a;
        font-size: 12.5px;
    }
    .type {
        font-weight: 800;
        color: #7fd3ff;
    }
    .text {
        color: #e8f1ff;
    }
    .goal {
        display: flex;
        align-items: center;
        gap: 7px;
        font-size: 12.5px;
        color: #b7c7de;
    }
    .dots {
        display: inline-flex;
        gap: 3px;
    }
    .dot {
        width: 10px;
        height: 10px;
        border-radius: 2px;
        border: 1.5px solid #5d6f8f;
    }
    .dot.filled {
        background: #d9a93a;
        border-color: #f3df9c;
    }
    .title {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 3px 7px;
        border-radius: 4px;
        background: #b08a3a;
        color: #1c1405;
        font-size: 12.5px;
        font-weight: 800;
    }
    .kept {
        font-size: 12.5px;
        color: #b7c7de;
    }
</style>
