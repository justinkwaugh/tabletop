<script lang="ts">
    import type { TechField } from '@tabletop/stellar-horizons-2'
    import { TECH_MARKER_ART } from '$lib/art/manifest.js'

    let {
        field,
        value,
        size = 34,
        dimmed = false,
        onclick
    }: {
        field: TechField
        value: number
        size?: number
        dimmed?: boolean
        onclick?: () => void
    } = $props()
</script>

{#if onclick}
    <button type="button" class="marker" class:dimmed {onclick} title="{field} {value}">
        <img
            src={TECH_MARKER_ART[`${field}-${value}`]}
            alt="{field} {value}"
            width={size}
            height={size}
        />
    </button>
{:else}
    <img
        class="marker"
        class:dimmed
        src={TECH_MARKER_ART[`${field}-${value}`]}
        alt="{field} {value}"
        width={size}
        height={size}
    />
{/if}

<style>
    .marker {
        display: inline-block;
        border-radius: 4px;
    }

    .marker.dimmed {
        opacity: 0.35;
    }
</style>
