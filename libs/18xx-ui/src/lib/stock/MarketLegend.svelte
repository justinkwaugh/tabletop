<script lang="ts">
    import type { MarketZone } from '../session/titlePresentation.js'
    import { marketColors } from './marketColors.js'

    let { zones }: { zones: readonly MarketZone[] } = $props()
</script>

<dl class="market-legend" aria-label="Market zones">
    {#each zones as zone (zone.color)}
        <div class="zone">
            <dt>
                <span
                    class="swatch"
                    aria-hidden="true"
                    style:background={marketColors[zone.color] ?? zone.color}
                ></span>{zone.name}
            </dt>
            <dd>{zone.description}</dd>
        </div>
    {/each}
</dl>

<style>
    .market-legend {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 6px 20px;
        margin: 8px 12px;
        font-size: 12px;
        color: var(--rail-text, #514536);
    }
    .zone {
        display: flex;
        align-items: baseline;
        gap: 6px;
        max-width: 28rem;
    }
    dt {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        font-weight: 600;
        white-space: nowrap;
    }
    dd {
        margin: 0;
        color: var(--rail-muted, #887969);
    }
    .swatch {
        width: 12px;
        height: 12px;
        border-radius: 2px;
        border: 1px solid var(--rail-border, #b8a995);
    }
</style>
