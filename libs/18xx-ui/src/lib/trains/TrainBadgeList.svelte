<script lang="ts">
    import TrainBadge from './TrainBadge.svelte'
    import { trainGroups } from './trainGroups.js'
    let {
        definitionIds,
        name,
        colors
    }: {
        definitionIds: readonly string[]
        name: (definitionId: string) => string
        colors: Readonly<Record<string, string>>
    } = $props()
    const groups = $derived(trainGroups(definitionIds))
</script>

{#each groups as group (group.definitionId)}{#if group.count >= 3}<span class="counted"
            >{group.count}×<TrainBadge
                name={name(group.definitionId)}
                color={colors[group.definitionId]}
            /></span
        >{:else}{#each { length: group.count }, index (index)}<TrainBadge
                name={name(group.definitionId)}
                color={colors[group.definitionId]}
            />{/each}{/if}{/each}

<style>
    .counted {
        display: inline-flex;
        align-items: center;
        gap: 0.15em;
        white-space: nowrap;
    }
</style>
