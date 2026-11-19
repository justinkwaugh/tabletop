<script lang="ts">
    import { CrownPath, StarPath } from '$lib/utils/pieceShapes.js'
    import type { SeatPaint } from '$lib/model/seatPaint.js'
    import { scoreWords, type SeatPanelView } from '$lib/model/seatPanel.js'
    import { pawnsNoteOf, seatLinesOf, serviceShieldOf } from '$lib/model/seatLines.js'
    import SeatCards from './SeatCards.svelte'
    import SeatHoldings from './SeatHoldings.svelte'
    import SeatSupply from './SeatSupply.svelte'

    /**
     * Contract, Seat panel: a sealed charter roll, a parchment sheet hung from a wooden roller, the
     * seat colour its ribbon and wax seal. It draws one derivation of the seat and reads nothing
     * else: the ribbon, then three lines (cards; goods, shillings, seals; what the seat holds).
     * Guild places are the standings'. `reading` is the same panel at the open seat's size.
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
    let lines = $derived(seatLinesOf(view))
    let shield = $derived(serviceShieldOf(view))
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
            {#if shield}
                <svg
                    class="shrink-0"
                    width={14 * scale}
                    height={14 * scale}
                    viewBox="0 0 24 24"
                    role="img"
                    aria-label={shield}
                    data-service-shield={view.service.covered}
                    data-vassal={view.service.vassal ? '' : undefined}
                >
                    <title>{shield}</title>
                    <path
                        d="M12 2 L20 5 V11 C20 16 16.5 20 12 22 C7.5 20 4 16 4 11 V5 Z"
                        fill={view.service.vassal ? 'currentColor' : 'none'}
                        stroke="currentColor"
                        stroke-width="2"
                    ></path>
                </svg>
            {/if}
            <span
                class="ml-auto inline-flex shrink-0 items-center gap-[0.2em] font-bold"
                title={scoreWords(view.ribbon.score, view.ribbon.leading)}
                data-seat-score={view.ribbon.score}
            >
                {#if view.ribbon.leading}
                    <svg
                        width={12 * scale}
                        height={12 * scale}
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                        data-score-leader
                    >
                        <path d={StarPath} fill="currentColor"></path>
                    </svg>
                {/if}
                {view.ribbon.score} vp
            </span>
        </button>
        <div class="body flex flex-col gap-[0.3em]" title={pawnsNoteOf(view)}>
            <SeatCards items={lines.cards} {paint} {scale} />
            <SeatSupply items={lines.supply} {scale} />
            <SeatHoldings items={lines.holdings} {paint} {scale} />
        </div>
    </div>
    <svg
        class="wax"
        width={20 * scale}
        height={20 * scale}
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
        padding: 0 0.5em 0.5em;
    }

    .roller {
        position: relative;
        height: 0.7em;
        margin: 0 -0.5em;
        border-radius: 0.45em;
        background: linear-gradient(var(--feudum-wood-piece), var(--feudum-wood-dark));
    }

    .sheet {
        padding-bottom: 0.8em;
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
        position: relative;
        padding: 0.2em 0.6em;
        cursor: pointer;
    }

    /*
     * The waiting ring pulses by its opacity alone, which the compositor runs without repainting the
     * ribbon each frame; it lies within the ribbon's padding, clear of its words.
     */
    .ribbon.deciding::after {
        content: '';
        position: absolute;
        inset: 0;
        border-radius: inherit;
        box-shadow: inset 0 0 0 0.15em var(--feudum-accent);
        pointer-events: none;
        animation: ribbon-pulse 2.5s infinite;
    }

    @keyframes ribbon-pulse {
        0%,
        100% {
            opacity: 0;
        }
        50% {
            opacity: 1;
        }
    }

    @media (prefers-reduced-motion: reduce) {
        .ribbon.deciding::after {
            animation: none;
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
        padding: 0.4em 2em 0 0.55em;
    }

    .wax {
        position: absolute;
        right: 1em;
        bottom: 0.2em;
    }
</style>
