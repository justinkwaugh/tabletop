<script lang="ts">
    import type { Snippet } from 'svelte'
    import { PanelPalette } from '$lib/utils/playerPanel.js'

    let { title, children }: { title: string; children: Snippet } = $props()

    const Star = 'M5 0 L6.5 3.5 L10 5 L6.5 6.5 L5 10 L3.5 6.5 L0 5 L3.5 3.5 Z'
</script>

{#snippet ornament()}
    <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
        <path d={Star} fill={PanelPalette.brass}></path>
    </svg>
{/snippet}

<section
    aria-label={title}
    class="aid-card relative w-[270px] shrink-0 overflow-hidden rounded-lg text-left text-[13px] leading-[1.35]"
    style:--tile-light={PanelPalette.tileLight}
    style:--tile-deep={PanelPalette.tileDeep}
    style:--trim={PanelPalette.trim}
    style:--brass={PanelPalette.brass}
    style:--gold={PanelPalette.gold}
    style:--cream={PanelPalette.cream}
    style:--parchment={PanelPalette.parchment}
    style:--glaze={PanelPalette.glaze}
    style:color={PanelPalette.cream}
>
    <h2
        class="aid-header marracash-merchant flex items-center justify-center gap-2.5 pt-2.5 pb-2 text-[19px]"
    >
        {@render ornament()}<span style:color={PanelPalette.gold}>{title}</span>{@render ornament()}
    </h2>
    <div class="px-4 pt-1 pb-3.5">
        {@render children()}
    </div>
</section>

<style>
    .aid-card {
        background: var(--glaze);
        box-shadow: 0 12px 28px rgb(0 0 0 / 0.5);
    }

    /* The trim sits above the patterned header, which would otherwise paint over it */
    .aid-card::after {
        content: '';
        position: absolute;
        inset: 0;
        border-radius: inherit;
        pointer-events: none;
        box-shadow:
            inset 0 0 0 2px var(--trim),
            inset 0 0 0 4px var(--tile-deep),
            inset 0 0 0 5px color-mix(in srgb, var(--trim) 50%, transparent);
    }

    .aid-header {
        border-bottom: 1px solid color-mix(in srgb, var(--brass) 55%, transparent);
        background:
            radial-gradient(circle at 50% 50%, rgb(255 255 255 / 0.07) 0 3px, #0000 3.5px) 0 0 /
                14px 14px,
            conic-gradient(
                    from 45deg,
                    rgb(255 255 255 / 0.04) 0 25%,
                    #0000 0 50%,
                    rgb(255 255 255 / 0.04) 0 75%,
                    #0000 0
                )
                0 0 / 14px 14px,
            linear-gradient(160deg, var(--tile-light), var(--tile-deep));
    }

    .aid-card :global(.aid-heading) {
        margin: 11px 0 3px;
        font-family: 'Libre Caslon Text', Georgia, serif;
        font-weight: 700;
        font-size: 11px;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: var(--brass);
    }

    .aid-card :global(.aid-lead) {
        margin-bottom: 2px;
        font-size: 12px;
        font-style: italic;
        color: color-mix(in srgb, var(--cream) 80%, transparent);
    }

    .aid-card :global(.aid-table) {
        width: 100%;
        border-collapse: collapse;
    }

    .aid-card :global(.aid-table th) {
        padding: 0 0 3px;
        font-family: 'Libre Caslon Text', Georgia, serif;
        font-weight: 700;
        font-size: 10px;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        text-align: left;
        color: color-mix(in srgb, var(--cream) 65%, transparent);
    }

    .aid-card :global(.aid-table td) {
        padding: 1px 0;
    }

    .aid-card :global(.aid-gain) {
        font-family: 'MarraCash El Messiri', Georgia, serif;
        font-weight: 700;
        font-size: 15px;
        color: #9be39a;
    }

    .aid-card :global(.aid-figure) {
        font-family: 'MarraCash El Messiri', Georgia, serif;
        font-weight: 700;
        color: var(--gold);
    }
</style>
