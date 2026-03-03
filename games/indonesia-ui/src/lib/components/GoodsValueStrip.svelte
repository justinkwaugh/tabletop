<script lang="ts">
    import SimpleOilIcon from '$lib/images/SimpleOilIcon.svelte'
    import SimpleRiceIcon from '$lib/images/SimpleRiceIcon.svelte'
    import SimpleRubberStripIcon from '$lib/images/SimpleRubberStripIcon.svelte'
    import SimpleShipIcon from '$lib/images/SimpleShipIcon.svelte'
    import SimpleSiapSajiIcon from '$lib/images/SimpleSiapSajiIcon.svelte'
    import SimpleSpiceIcon from '$lib/images/SimpleSpiceIcon.svelte'

    const STRIP_ICON_BROWN = '#7a5d3f'
    const STRIP_ICON_BROWN_LIGHT = '#ddcebf'

    const valueEntries = [
        {
            key: 'ship',
            label: 'Ship',
            iconComponent: SimpleShipIcon,
            iconProps: { fill: STRIP_ICON_BROWN },
            iconWidth: 22,
            iconHeight: 18,
            value: 10
        },
        {
            key: 'rice',
            label: 'Rice',
            iconComponent: SimpleRiceIcon,
            iconProps: { fill: STRIP_ICON_BROWN },
            iconWidth: 20,
            iconHeight: 20,
            value: 20
        },
        {
            key: 'spice',
            label: 'Spice',
            iconComponent: SimpleSpiceIcon,
            iconProps: { fill: STRIP_ICON_BROWN },
            iconWidth: 20,
            iconHeight: 20,
            value: 25
        },
        {
            key: 'rubber',
            label: 'Rubber',
            iconComponent: SimpleRubberStripIcon,
            iconProps: { baseFill: STRIP_ICON_BROWN, coreFill: STRIP_ICON_BROWN_LIGHT },
            iconWidth: 20,
            iconHeight: 20,
            value: 30
        },
        {
            key: 'siap-saji',
            label: 'Siap Saji',
            iconComponent: SimpleSiapSajiIcon,
            iconProps: { fill: STRIP_ICON_BROWN },
            iconWidth: 24,
            iconHeight: 20,
            value: 35
        },
        {
            key: 'oil',
            label: 'Oil',
            iconComponent: SimpleOilIcon,
            iconProps: { fill: STRIP_ICON_BROWN },
            iconWidth: 20,
            iconHeight: 20,
            value: 40
        }
    ] as const
</script>

<section class="goods-value-strip" aria-label="Goods and shipping values">
    {#each valueEntries as entry (entry.key)}
        <div class="goods-value-chip" title={`${entry.label}: ${entry.value}`}>
            <svelte:component
                this={entry.iconComponent}
                class="goods-value-icon"
                aria-hidden="true"
                focusable="false"
                width={entry.iconWidth}
                height={entry.iconHeight}
                {...entry.iconProps}
            />
            <span class="goods-value-number">{entry.value}</span>
        </div>
    {/each}
</section>

<style>
    .goods-value-strip {
        display: grid;
        grid-template-columns: repeat(6, minmax(0, 1fr));
        gap: 4px;
        margin-top: -0.5rem;
        padding: 6px;
        border-bottom: 1px solid rgba(122, 93, 63, 0.52);
        background: transparent;
    }

    .goods-value-chip {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 4px;
        padding: 3px 2px;
    }

    .goods-value-icon {
        display: block;
    }

    .goods-value-number {
        font-size: 11px;
        line-height: 1;
        font-weight: 700;
        color: #62422b;
        letter-spacing: 0.01em;
        opacity: 0.94;
    }
</style>
