<script lang="ts">
    // PROTOTYPE: a faction's bases as map tabs, either in one strip or one detailed row each.
    import { baseTier, type MockFaction } from './campaignMock.svelte.js'
    import Goods from './Goods.svelte'
    import Tab from './Tab.svelte'

    let {
        faction,
        detail = false,
        height = 20
    }: { faction: MockFaction; detail?: boolean; height?: number } = $props()
    const free = $derived(Math.max(0, faction.maxBases - faction.bases.length))
</script>

{#if detail}
    <div class="rows">
        {#each faction.bases as base (base.system)}
            {@const tier = baseTier(base.settlements)}
            <div class="row">
                <Tab
                    faction={faction.faction}
                    settlements={base.settlements}
                    {height}
                    blockaded={base.blockaded}
                />
                <div class="text">
                    <div class="system">
                        {base.system}
                        {#if base.blockaded}<span class="bad">blockaded</span>{/if}
                    </div>
                    <div class="yield">
                        {#if tier.cash > 0}+${tier.cash}B, +{tier.tech} tech{:else}no bonus yet{/if}
                        {#if base.production}· making {base.production.toLowerCase()}{/if}
                    </div>
                </div>
                <Goods goods={base.goods} capacity={tier.goods * 2} size={15} />
            </div>
        {/each}
    </div>
{:else}
    <div class="strip" title="{faction.bases.length} of {faction.maxBases} bases">
        {#each faction.bases as base (base.system)}
            <span title="{base.system}: {base.settlements} settlements">
                <Tab
                    faction={faction.faction}
                    settlements={base.settlements}
                    {height}
                    blockaded={base.blockaded}
                />
            </span>
        {/each}
        {#each { length: free } as _, index (index)}
            <span class="slot" style:height="{height * 0.72}px" style:width="{height * 1.1}px"
            ></span>
        {/each}
    </div>
{/if}

<style>
    .strip {
        display: flex;
        align-items: center;
        gap: 2px;
    }
    .slot {
        margin: 0 2px;
        border: 1.5px solid #2a3852;
        border-radius: 3px;
        transform: skewX(18deg);
    }
    .rows {
        display: flex;
        flex-direction: column;
        gap: 6px;
    }
    .row {
        display: grid;
        grid-template-columns: 44px 1fr auto;
        align-items: center;
        gap: 6px;
    }
    .system {
        font-size: 13px;
        font-weight: 700;
        color: #e8f1ff;
    }
    .yield {
        font-size: 12px;
        color: #9fb4d0;
    }
    .bad {
        margin-left: 4px;
        font-weight: 700;
        color: #ff8a7a;
    }
</style>
