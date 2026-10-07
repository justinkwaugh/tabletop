<script lang="ts">
    import type { Snippet } from 'svelte'
    import { PanelPalette } from '$lib/utils/playerPanel.js'

    let { title, children }: { title: string; children: Snippet } = $props()
</script>

<!-- Dressed like the action panel: parchment in a brass double frame, titled on a teal plaque -->
<section
    aria-label={title}
    class="aid-card relative w-[270px] shrink-0 text-left"
    style:--tile-light={PanelPalette.tileLight}
    style:--tile-deep={PanelPalette.tileDeep}
    style:--trim={PanelPalette.trim}
    style:--gold={PanelPalette.gold}
    style:--scroll-light={PanelPalette.scrollLight}
    style:--scroll-deep={PanelPalette.scrollDeep}
    style:--scroll-inset={PanelPalette.scrollInset}
>
    <h2 class="marracash-merchant plaque">{title}</h2>
    <div class="body">
        {@render children()}
    </div>
</section>

<style>
    .aid-card {
        --plaque-height: 30px;
        --ink: #3d2f1f;
        --ink-muted: #6b5640;
        --rule: rgb(107 79 48 / 0.18);
        margin-top: calc(var(--plaque-height) / 2);
        border-radius: 10px;
        font-size: 13px;
        line-height: 1.4;
        color: var(--ink);
        background: linear-gradient(var(--scroll-light), var(--scroll-deep));
        box-shadow:
            inset 0 0 0 2px var(--trim),
            inset 0 0 0 5px var(--scroll-inset),
            inset 0 0 0 6px color-mix(in srgb, var(--trim) 55%, transparent),
            0 12px 28px rgb(0 0 0 / 0.45);
    }

    .plaque {
        --notch: 12px;
        position: absolute;
        top: calc(var(--plaque-height) / -2);
        left: 50%;
        transform: translateX(-50%);
        height: var(--plaque-height);
        display: flex;
        align-items: center;
        padding: 0 24px;
        font-size: 16px;
        letter-spacing: 0.04em;
        white-space: nowrap;
        color: var(--gold);
        isolation: isolate;
        filter: drop-shadow(0 2px 2px rgb(0 0 0 / 0.35));
    }

    .plaque::before,
    .plaque::after {
        content: '';
        position: absolute;
        z-index: -1;
        clip-path: polygon(
            var(--notch) 0,
            calc(100% - var(--notch)) 0,
            100% 50%,
            calc(100% - var(--notch)) 100%,
            var(--notch) 100%,
            0 50%
        );
    }

    .plaque::before {
        inset: 0;
        background: var(--trim);
    }

    .plaque::after {
        --notch: 11px;
        inset: 2px 2.5px;
        background:
            radial-gradient(circle at 50% 50%, rgb(255 255 255 / 0.08) 0 2.5px, #0000 3px) 0 0 /
                12px 12px,
            linear-gradient(160deg, var(--tile-light), var(--tile-deep));
    }

    .body {
        padding: calc(var(--plaque-height) / 2 + 8px) 18px 16px;
    }

    .aid-card :global(.aid-heading) {
        display: flex;
        align-items: center;
        gap: 6px;
        margin: 14px 0 2px;
        font-family: 'MarraCash El Messiri', Georgia, serif;
        font-weight: 700;
        font-size: 15px;
        line-height: 1.3;
        letter-spacing: 0.02em;
        color: var(--tile-light);
    }

    .aid-card :global(.aid-heading)::before {
        content: '✦';
        font-size: 10px;
        color: var(--trim);
    }

    .aid-card :global(.aid-heading)::after {
        content: '';
        flex: 1;
        height: 1px;
        background: linear-gradient(
            90deg,
            color-mix(in srgb, var(--trim) 60%, transparent),
            transparent
        );
    }

    .aid-card :global(.aid-heading:first-child) {
        margin-top: 0;
    }

    .aid-card :global(.aid-lead) {
        margin-bottom: 4px;
        font-size: 12px;
        font-style: italic;
        color: var(--ink-muted);
    }

    /* Sized to their content, so two-column tables sit centred with a set gap instead of at the card's edges */
    .aid-card :global(.aid-table) {
        width: auto;
        border-collapse: collapse;
    }

    .aid-card :global(.aid-table:has(td + td)) {
        margin-inline: auto;
    }

    .aid-card :global(.aid-table.full-width) {
        width: 100%;
    }

    .aid-card :global(.aid-table.full-width td + td),
    .aid-card :global(.aid-table.full-width th + th) {
        padding-left: 0;
    }

    .aid-card :global(.aid-table td + td),
    .aid-card :global(.aid-table th + th) {
        padding-left: 48px;
    }

    .aid-card :global(.aid-table th) {
        padding: 0 0 2px;
        border-bottom: 1px solid var(--rule);
        font-weight: 400;
        font-size: 11px;
        letter-spacing: 0.02em;
        text-align: left;
        color: #8a7358;
    }

    .aid-card :global(.aid-table td) {
        height: 22px;
        padding: 0;
        vertical-align: middle;
    }

    .aid-card :global(.aid-gain),
    .aid-card :global(.aid-figure) {
        font-family: 'MarraCash El Messiri', Georgia, serif;
        font-weight: 700;
        font-size: 15px;
        line-height: 1;
    }

    .aid-card :global(.aid-gain) {
        color: #2e6b34;
    }

    .aid-card :global(.aid-figure) {
        color: var(--ink);
    }
</style>
