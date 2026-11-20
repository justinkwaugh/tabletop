<script lang="ts">
    import PresidentBadge from './PresidentBadge.svelte'
    let {
        name,
        president,
        label,
        title
    }: { name: string; president: boolean; label: string; title: string } = $props()
</script>

<!-- Glued to the final letter, not the whole word, so an over-long word can still break. -->
{#if president}<span class="president-name"
        >{name.slice(0, -1)}<span class="glued"
            >{name.slice(-1)}<PresidentBadge {label} {title} /></span
        ></span
    >{:else}{name}{/if}

<style>
    .president-name {
        overflow-wrap: anywhere;
    }
    .glued {
        white-space: nowrap;
    }
</style>
