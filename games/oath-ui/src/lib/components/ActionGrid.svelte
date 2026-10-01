<script lang="ts">
    import TokenText from '$lib/components/TokenText.svelte'
    import { assertExists } from '@tabletop/common'
    import { ActionType } from '@tabletop/oath'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { humanizeReason } from '$lib/model/names.js'
    import {
        MAJOR_ACTIONS,
        MINOR_ACTIONS,
        UNTARGETED_ACTIONS,
        type ActionEntry
    } from '$lib/model/actionCatalogue.js'
    import { freeActionDueLine, reasonActionUnavailable } from '$lib/model/actionAvailability.js'
    import { actionImage } from '$lib/images/actionImages.js'

    // R-4.2 — every action is listed, the unavailable ones dimmed with the engine's reason.
    let gameSession = getGameSession()
    let gameState = $derived(gameSession.gameState)
    let valid = $derived(new Set(gameSession.validActionTypes))
    let busy = $derived(gameSession.busy)

    let seat = $derived.by(() => {
        const seat = gameSession.myPlayerState
        assertExists(seat, 'The Act Phase grid is shown to the seat whose turn it is')
        return seat
    })

    // R-4.2.a — a Campaign right after Knights Errant or Hunting Party costs nothing.
    function costLabel(entry: ActionEntry): string {
        if (entry.type !== ActionType.Campaign) return entry.cost
        return gameSession.campaignSupplyCost === 0 ? 'no Supply' : entry.cost
    }

    function available(entry: ActionEntry): boolean {
        return valid.has(entry.type)
    }

    function blockedBecause(entry: ActionEntry): string | undefined {
        return reasonActionUnavailable(gameState, seat.playerId, entry.type, (id: string) =>
            gameSession.getPlayerName(id)
        )
    }

    // A dimmed tile answers "why not" on tap, where there is no hover; the reason is the
    // engine's for the state and seat it was tapped in, and a hover on another tile replaces it.
    let tap = $state.raw<{ entry: ActionEntry; seatId: string; actionCount: number } | undefined>(
        undefined
    )
    let tapped = $derived(
        tap && tap.seatId === seat.playerId && tap.actionCount === gameState.actionCount
            ? tap.entry
            : undefined
    )
    let tappedReason = $derived(tapped && !available(tapped) ? blockedBecause(tapped) : undefined)

    let hoveredEntry = $state.raw<ActionEntry | undefined>(undefined)

    let freeActionDue = $derived(freeActionDueLine(gameState, seat.playerId))

    function send(type: ActionType) {
        if (type === ActionType.EndActPhase) void gameSession.endActPhase()
        else if (type === ActionType.SelfExile) void gameSession.selfExile()
    }

    // A pressed tile gives way to its panel without a pointer leave, so the line clears here.
    function press(entry: ActionEntry, ok: boolean) {
        tap = ok ? undefined : { entry, seatId: seat.playerId, actionCount: gameState.actionCount }
        if (!ok) return
        hoveredEntry = undefined
        if (UNTARGETED_ACTIONS.has(entry.type)) send(entry.type)
        else gameSession.chooseAction(entry.type)
    }

    function hover(entry: ActionEntry, on: boolean) {
        if (on && tapped !== entry) tap = undefined
        if (on) hoveredEntry = entry
        else if (hoveredEntry === entry) hoveredEntry = undefined
    }

    // What a major tile and a minor chip share; they differ in look and in the cost they print.
    function tile(entry: ActionEntry, describe: string) {
        const ok = available(entry)
        return {
            ok,
            attrs: {
                disabled: busy,
                'aria-disabled': !ok,
                title: humanizeReason(ok ? undefined : blockedBecause(entry)) ?? describe,
                onpointerenter: () => hover(entry, true),
                onpointerleave: () => hover(entry, false),
                onfocus: () => hover(entry, true),
                onblur: () => hover(entry, false),
                onclick: () => press(entry, ok)
            }
        }
    }
</script>

<div class="head flex items-center justify-between gap-2 mb-2">
    <h3 class="text-[11px] uppercase tracking-[0.2em] text-oath-heading">
        Act Phase
        <span class="ml-2 normal-case tracking-normal text-oath-text-muted"
            >Supply {seat.supply}</span
        >
    </h3>
    {#if valid.has(ActionType.EndActPhase)}
        <!-- R-4.2 — the phase may end after zero actions. -->
        <button
            class="shrink-0 rounded bg-oath-control hover:bg-oath-control-hover disabled:opacity-40
                   px-2 py-1 text-xs font-semibold"
            disabled={busy}
            onclick={() => send(ActionType.EndActPhase)}
        >
            End the Act Phase
        </button>
    {/if}
</div>

{#if freeActionDue}
    <!-- R-10.2 — a granted free action comes next or not at all. -->
    <div class="due mb-1.5 flex items-center justify-between gap-2 text-[11px] leading-snug">
        <span class="text-oath-heading">{freeActionDue}</span>
        {#if valid.has(ActionType.ForgoFreeAction)}
            <button
                class="shrink-0 rounded bg-oath-control hover:bg-oath-control-hover disabled:opacity-40
                       px-2 py-1 text-xs font-semibold"
                disabled={busy}
                onclick={() => void gameSession.forgoFreeAction()}
            >
                Give it up
            </button>
        {/if}
    </div>
{/if}

<div class="actions">
    <div class="majors flex flex-wrap gap-1.5">
        {#each MAJOR_ACTIONS as entry (entry.type)}
            {@const t = tile(entry, `${entry.label} — ${costLabel(entry)}. ${entry.summary}`)}
            <button
                class="group flex w-[92px] flex-col items-center gap-1 rounded border px-1
                       py-1.5 text-center transition-colors
                       {t.ok
                    ? 'border-oath-frame bg-oath-surface-raised hover:border-oath-accent hover:bg-oath-surface-raised cursor-pointer'
                    : 'border-oath-divider bg-oath-surface opacity-55 cursor-not-allowed'}"
                {...t.attrs}
            >
                <img
                    src={actionImage(entry.type)}
                    alt=""
                    class="h-9 w-9 {t.ok ? '' : 'grayscale'}"
                />
                <span class="text-[11px] font-semibold leading-none">{entry.label}</span>
                <span class="text-[10px] leading-none text-oath-text-muted">{costLabel(entry)}</span
                >
            </button>
        {/each}
    </div>

    <div class="minors mt-1.5 flex flex-wrap gap-1.5">
        {#each MINOR_ACTIONS as entry (entry.type)}
            {@const t = tile(entry, `${entry.label}. ${entry.summary}`)}
            <button
                class="rounded border px-2 py-1 text-[11px] font-medium transition-colors
                       {t.ok
                    ? 'border-oath-frame bg-oath-surface-raised hover:border-oath-accent cursor-pointer'
                    : 'border-oath-divider bg-oath-surface text-oath-text-muted opacity-70 cursor-not-allowed'}"
                {...t.attrs}
            >
                {entry.label}
            </button>
        {/each}
    </div>
</div>

<!-- One fixed line: what the hovered action does, or why the tapped one is refused. -->
<div class="strip mt-1.5 min-h-[1.5rem] text-[11px] leading-snug">
    {#if tappedReason}
        <span class="text-oath-danger"><TokenText text={humanizeReason(tappedReason) ?? ''} /></span
        >
    {:else if hoveredEntry}
        <span class="font-semibold text-oath-text">{hoveredEntry.label}</span>
        <span class="text-oath-text-muted">{hoveredEntry.cost}</span>
        <span class="text-oath-text-muted">— <TokenText text={hoveredEntry.summary} /></span>
    {/if}
</div>

<style>
    @media (max-width: 640px) and (orientation: portrait) {
        .actions {
            display: grid;
            grid-template-columns: auto minmax(0, 1fr);
            column-gap: 8px;
            align-items: start;
            overflow: hidden;
        }
        .majors {
            display: grid;
            grid-template-columns: repeat(3, 64px);
            gap: 5px;
        }
        .majors :global(button) {
            width: 64px;
            padding-left: 2px;
            padding-right: 2px;
        }
        /* `min-width: 0`: a flex container in a grid track otherwise sizes to
           its longest chip and runs past the panel's edge. */
        .minors {
            margin-top: 0;
            min-width: 0;
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 5px;
        }
        .minors :global(button) {
            min-height: 36px;
            padding: 4px 6px;
            font-size: 11px;
            line-height: 1.15;
            white-space: normal;
            text-align: center;
        }
    }

    /* A phone held sideways: one row each for tiles and chips, and the strip in the header. */
    @media (max-height: 520px) and (orientation: landscape) {
        .head {
            margin-bottom: 4px;
        }
        .strip {
            position: absolute;
            left: 160px;
            right: 136px;
            top: 13px;
            margin: 0;
            min-height: 0;
            font-size: 10px;
            line-height: 1.2;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .actions {
            display: block;
        }
        .majors {
            display: grid;
            grid-template-columns: repeat(6, minmax(0, 1fr));
            gap: 4px;
        }
        .majors :global(button) {
            width: auto;
            padding: 3px 2px;
            gap: 2px;
        }
        .majors :global(img) {
            height: 26px;
            width: 26px;
        }
        .majors :global(button span:first-of-type) {
            font-size: 10px;
        }
        .majors :global(button span:last-of-type) {
            font-size: 9px;
        }
        .minors {
            margin-top: 4px;
            display: grid;
            grid-template-columns: repeat(7, minmax(0, 1fr));
            gap: 4px;
        }
        .minors :global(button) {
            min-height: 34px;
            padding: 2px 3px;
            font-size: 9.5px;
            line-height: 1.1;
            white-space: normal;
            text-align: center;
        }
    }
</style>
