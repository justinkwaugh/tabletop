<script lang="ts">
    // PROTOTYPE: a faction's ships as map pips, either in one strip or grouped by system.
    import type { MockFaction, MockShip } from './campaignMock.svelte.js'
    import Pip from './Pip.svelte'

    let {
        faction,
        size = 22,
        bySystem = false
    }: { faction: MockFaction; size?: number; bySystem?: boolean } = $props()
    const free = $derived(Math.max(0, faction.maxShips - faction.ships.length))
    const systems = $derived.by(() => {
        const groups: { system: string; ships: MockShip[] }[] = []
        for (const ship of faction.ships) {
            const group = groups.find((candidate) => candidate.system === ship.system)
            if (group) group.ships.push(ship)
            else groups.push({ system: ship.system, ships: [ship] })
        }
        return groups
    })
</script>

{#if bySystem}
    <div class="systems">
        {#each systems as group (group.system)}
            <div class="system">
                <span class="where">{group.system}</span>
                <span class="pips">
                    {#each group.ships as ship (ship.ship.id)}
                        <span class="named">
                            <Pip {ship} faction={faction.faction} {size} />
                            <span class="ship-name"
                                >{ship.ship.name}{ship.transit ? ` · ${ship.transit}` : ''}</span
                            >
                        </span>
                    {/each}
                </span>
            </div>
        {/each}
    </div>
{:else}
    <div class="strip" title="{faction.ships.length} of {faction.maxShips} ships">
        {#each faction.ships as ship (ship.ship.id)}
            <Pip {ship} faction={faction.faction} {size} />
        {/each}
        {#each { length: free } as _, index (index)}
            <span class="slot" style:width="{size * 0.72}px" style:height="{size * 0.72}px"></span>
        {/each}
    </div>
{/if}

<style>
    .strip {
        display: flex;
        align-items: center;
        gap: 1px;
    }
    .slot {
        margin: 0 3px;
        border: 1.5px solid #2a3852;
        border-radius: 4px;
    }
    .systems {
        display: flex;
        flex-direction: column;
        gap: 4px;
    }
    .system {
        display: grid;
        grid-template-columns: minmax(0, 92px) 1fr;
        align-items: start;
        gap: 6px;
    }
    .where {
        padding-top: 3px;
        font-size: 12.5px;
        color: #b7c7de;
    }
    .pips {
        display: flex;
        flex-wrap: wrap;
        gap: 2px 8px;
    }
    .named {
        display: inline-flex;
        align-items: center;
        gap: 3px;
    }
    .ship-name {
        font-size: 12.5px;
        color: #dbe7f5;
    }
</style>
