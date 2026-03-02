<script lang="ts">
    import simpleOilIconUrl from '$lib/images/simple-oil.svg'
    import simpleRiceIconUrl from '$lib/images/simple-rice.svg'
    import simpleRubberIconUrl from '$lib/images/simple-rubber-strip.svg'
    import simpleShipIconUrl from '$lib/images/simple-ship.svg'
    import simpleSiapSajiIconUrl from '$lib/images/simple-siapsaji.svg'
    import simpleSpiceIconUrl from '$lib/images/simple-spice.svg'

    const valueEntries = [
        {
            key: 'ship',
            label: 'Ship',
            iconUrl: simpleShipIconUrl,
            value: 10
        },
        {
            key: 'rice',
            label: 'Rice',
            iconUrl: simpleRiceIconUrl,
            value: 20
        },
        {
            key: 'spice',
            label: 'Spice',
            iconUrl: simpleSpiceIconUrl,
            value: 25
        },
        {
            key: 'rubber',
            label: 'Rubber',
            iconUrl: simpleRubberIconUrl,
            value: 30
        },
        {
            key: 'siap-saji',
            label: 'Siap Saji',
            iconUrl: simpleSiapSajiIconUrl,
            value: 35
        },
        {
            key: 'oil',
            label: 'Oil',
            iconUrl: simpleOilIconUrl,
            value: 40
        }
    ] as const
</script>

<section class="goods-value-strip" aria-label="Goods and shipping values">
    {#each valueEntries as entry (entry.key)}
        <div class="goods-value-chip" title={`${entry.label}: ${entry.value}`}>
            <img
                class={`goods-value-icon ${entry.key === 'ship' ? 'goods-value-icon-ship' : ''} ${entry.key === 'siap-saji'
                    ? 'goods-value-icon-siapsaji'
                    : ''} ${entry.key === 'rubber' ? 'goods-value-icon-rubber' : ''}`}
                src={entry.iconUrl}
                alt=""
                aria-hidden="true"
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
        width: 20px;
        height: 20px;
        object-fit: contain;
        display: block;
        filter: sepia(1) saturate(2.8) hue-rotate(342deg) brightness(0.56) contrast(0.95);
        opacity: 0.94;
    }

    .goods-value-icon-ship {
        width: 22px;
        height: 18px;
    }

    .goods-value-icon-siapsaji {
        width: 24px;
        height: 20px;
    }

    .goods-value-icon-rubber {
        filter: none;
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
