<script lang="ts">
    import { CrownPath } from '$lib/utils/pieceShapes.js'
    import type { SeatPaint } from '$lib/model/seatPaint.js'
    import type { SeatPanelView } from '$lib/model/seatPanel.js'
    import SeatCards from './SeatCards.svelte'
    import SeatStanding from './SeatStanding.svelte'
    import SeatSupply from './SeatSupply.svelte'
    import SeatWrits from './SeatWrits.svelte'

    /**
     * Contract, Seat panel: a sealed charter roll, a parchment sheet hung from a wooden roller, the
     * seat colour its ribbon and wax seal. It draws one derivation of the seat and reads nothing
     * else. `reading` is the same panel at the open seat's size.
     */
    let {
        view,
        paint,
        reading = false,
        ribbonLabel,
        onRibbon
    }: {
        view: SeatPanelView
        paint: SeatPaint
        reading?: boolean
        ribbonLabel?: string
        onRibbon?: () => void
    } = $props()

    const ReadingScale = 1.75
    const BaseFont = 13

    let scale = $derived(reading ? ReadingScale : 1)
</script>

<article
    class="roll relative text-left"
    style:font-size="{BaseFont * scale}px"
    data-seat-panel={view.playerId}
>
    <div class="roller" aria-hidden="true"></div>
    <div class="sheet bg-feudum-parchment text-feudum-ink">
        <button
            type="button"
            class="ribbon flex w-full items-center gap-[0.45em]"
            class:deciding={view.ribbon.deciding}
            style:background-color={paint.fill}
            style:color={paint.ink}
            aria-label={ribbonLabel}
            data-open-seat-of={view.playerId}
            data-deciding={view.ribbon.deciding ? '' : undefined}
            onclick={onRibbon}
        >
            <span class="numeral" data-turn-numeral={view.ribbon.turnNumeral}
                >{view.ribbon.turnNumeral}</span
            >
            <span class="name min-w-0 truncate">{view.ribbon.name}</span>
            {#if view.ribbon.startPlayer}
                <svg
                    class="shrink-0"
                    width={16 * scale}
                    height={16 * scale}
                    viewBox="0 0 24 24"
                    role="img"
                    aria-label="start player"
                    data-start-player-crown
                >
                    <title>start player</title>
                    <path d={CrownPath} fill="currentColor"></path>
                </svg>
            {/if}
            <span class="ml-auto shrink-0 font-bold" data-seat-score={view.ribbon.score}
                >{view.ribbon.score} vp</span
            >
        </button>
        <div class="body flex flex-col gap-[0.6em]">
            <SeatCards cards={view.cards} {paint} {scale} />
            <SeatSupply supply={view.supply} pouch={view.pouch} {paint} {scale} />
            <SeatWrits writs={view.writs} {scale} />
            <SeatStanding
                guilds={view.guilds}
                barrel={view.barrel}
                service={view.service}
                voyage={view.voyage}
                {paint}
                {scale}
            />
        </div>
    </div>
    <svg
        class="wax"
        width={30 * scale}
        height={30 * scale}
        viewBox="0 0 24 24"
        role="img"
        aria-label="{paint.owner} wax seal"
    >
        <title>{paint.owner} wax seal</title>
        <circle cx="12" cy="12" r="11" fill={paint.fill} stroke={paint.edge} stroke-width="1"
        ></circle>
        <circle cx="12" cy="12" r="8" fill="none" stroke={paint.ink} stroke-width="0.6"></circle>
    </svg>
</article>

<style>
    .roll {
        font-family: var(--feudum-font-text);
        line-height: 1.2;
        padding: 0 0.5em 0.9em;
    }

    .roller {
        position: relative;
        height: 0.9em;
        margin: 0 -0.5em;
        border-radius: 0.45em;
        background: linear-gradient(var(--feudum-wood-piece), var(--feudum-wood-dark));
    }

    .sheet {
        padding-bottom: 1.1em;
        clip-path: polygon(
            0 0,
            100% 0,
            100% calc(100% - 0.5em),
            85% 100%,
            70% calc(100% - 0.5em),
            55% 100%,
            40% calc(100% - 0.5em),
            25% 100%,
            10% calc(100% - 0.5em),
            0 100%
        );
    }

    .ribbon {
        padding: 0.3em 0.6em;
        cursor: pointer;
    }

    .ribbon.deciding {
        animation: ribbon-pulse 2.5s infinite;
    }

    @keyframes ribbon-pulse {
        0%,
        100% {
            box-shadow: inset 0 0 0 0.15em transparent;
        }
        50% {
            box-shadow: inset 0 0 0 0.15em var(--feudum-accent);
        }
    }

    @media (prefers-reduced-motion: reduce) {
        .ribbon.deciding {
            animation: none;
            box-shadow: inset 0 0 0 0.15em var(--feudum-accent);
        }
    }

    .name {
        font-family: var(--feudum-font-title);
        font-size: 1.2em;
    }

    .numeral {
        flex-shrink: 0;
        min-width: 1.4em;
        border-radius: 0.7em;
        border: 1px solid currentColor;
        text-align: center;
        font-size: 0.85em;
        font-weight: 700;
    }

    .body {
        padding: 0.55em 0.55em 0;
    }

    .wax {
        position: absolute;
        right: 1.2em;
        bottom: 0.1em;
    }
</style>
