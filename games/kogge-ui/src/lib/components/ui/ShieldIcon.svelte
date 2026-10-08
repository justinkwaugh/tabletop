<script lang="ts">
    import RouteShield from '../art/RouteShield.svelte'
    import HiddenShield from '../art/HiddenShield.svelte'

    let { value, size = 30 }: { value?: number; size?: number } = $props()
</script>

<svg
    width={size}
    height={size * 1.2}
    viewBox="0 0 40 48"
    class="inline-block shrink-0"
    aria-hidden="true"
>
    {#if value === undefined}
        <HiddenShield />
    {:else}
        <RouteShield {value} />
    {/if}
</svg>
