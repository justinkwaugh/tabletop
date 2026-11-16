<script lang="ts">
    import type { SeatPaint } from '$lib/model/seatPaint.js'

    /**
     * A seat as the panel names it: its colour and its name in a pill. A solid ring in the accent
     * marks a seat being waited on (`ringLabel` reads out why); a tick, a seat that is done.
     * `compact` keeps the name for a screen reader alone on a phone, where the seat strip names the
     * colours. `spoken` is read out after the name and not shown ("(you)", "choosing").
     */
    let {
        name,
        paint,
        ring = false,
        ringLabel,
        done = false,
        doneLabel = 'done',
        spoken,
        compact = false
    }: {
        name: string
        paint: SeatPaint
        ring?: boolean
        ringLabel?: string
        done?: boolean
        doneLabel?: string
        spoken?: string
        compact?: boolean
    } = $props()
</script>

<span
    class="inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 align-middle text-xs
        {compact ? 'max-sm:px-1' : ''}
        {ring
        ? 'border-feudum-accent text-feudum-text ring-1 ring-feudum-accent'
        : done
          ? 'border-feudum-frame text-feudum-text-muted'
          : 'border-feudum-frame text-feudum-text'}"
    data-seat-chip={name}
    ><span class="inline-block h-2.5 w-2.5 rounded-full" style:background-color={paint.fill}
    ></span><span class={compact ? 'max-sm:sr-only' : ''}>{name}</span>{#if spoken}<span
            class="sr-only">{` ${spoken}`}</span
        >{/if}{#if ring && ringLabel}<span class="sr-only">{` ${ringLabel}`}</span
        >{/if}{#if done}<span role="img" aria-label={doneLabel}>✓</span>{/if}</span
>
