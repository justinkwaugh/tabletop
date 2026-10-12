<script lang="ts">
    import type { TechField } from '@tabletop/stellar-horizons-2'
    import { TECH_MARKER_ART } from '$lib/art/manifest.js'

    // With `onclick` the marker is a button named by `label`.
    let {
        field,
        value,
        size = 34,
        label,
        onclick
    }: {
        field: TechField
        value: number
        size?: number
        label?: string
        onclick?: () => void
    } = $props()
</script>

{#if onclick}
    <button
        type="button"
        class="marker"
        aria-label={label ?? `${field} ${value}`}
        title={label ?? `${field} ${value}`}
        {onclick}
    >
        <img src={TECH_MARKER_ART[`${field}-${value}`]} alt="" width={size} height={size} />
    </button>
{:else}
    <img
        class="marker"
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

    /* The step panel styles every button as a boxed control; a marker is its own button. */
    button.marker {
        display: block;
        padding: 0;
        border: none;
        background: none;
        line-height: 0;
        outline: 2px solid transparent;
        outline-offset: 1px;
        transition:
            transform 120ms ease,
            outline-color 120ms ease;
    }

    button.marker img {
        display: block;
        border-radius: 4px;
    }

    button.marker:hover {
        background: none;
        outline-color: #7fd3ff;
        transform: translateY(-2px);
    }
</style>
