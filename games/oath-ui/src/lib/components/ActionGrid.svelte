<script lang="ts">
    import TokenText from '$lib/components/TokenText.svelte'
    import { PlayerName } from '@tabletop/frontend-components'
    import { assertExists } from '@tabletop/common'
    import { ActionType } from '@tabletop/oath'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { type ReasonPart } from '$lib/model/names.js'
    import { cardsMakingPossible } from '$lib/model/actionCards.js'
    import {
        MAJOR_ACTIONS,
        MINOR_ACTIONS,
        UNTARGETED_ACTIONS,
        type ActionEntry,
        type MajorEntry
    } from '$lib/model/actionCatalogue.js'
    import {
        freeActionDueLine,
        gridRefusal,
        refusalWords,
        tileCost
    } from '$lib/model/actionAvailability.js'
    import { actionImage } from '$lib/images/actionImages.js'
    import { unseenPeekSlots } from '$lib/model/relicKnowledge.js'

    // R-4.2 — the six majors are always listed, an unavailable one dimmed with why on a tap; a minor
    // is listed only when it can be taken.
    let gameSession = getGameSession()
    let gameState = $derived(gameSession.gameState)
    let valid = $derived(new Set(gameSession.validActionTypes))
    let busy = $derived(gameSession.busy)

    let seat = $derived.by(() => {
        const seat = gameSession.myPlayerState
        assertExists(seat, 'The Act Phase grid is shown to the seat whose turn it is')
        return seat
    })

    // R-7.4 — the cards that change an action are found with the powers.
    let cards = $derived(gameSession.actionCards)

    // R-6.3 — a relic already seen shows its face, so Peek is offered only for one not seen.
    function available(entry: ActionEntry): boolean {
        if (entry.type === ActionType.UseActionPower && cards.length > 0) return true
        if (!valid.has(entry.type)) return false
        if (entry.type === ActionType.Peek) {
            return unseenPeekSlots(gameState, seat.playerId).length > 0
        }
        return true
    }

    let minors = $derived(MINOR_ACTIONS.filter(available))

    // R-7.4 — where a card would make the action possible, Use a power is ringed while the reason
    // shows; the card is named only behind it.
    function refusalOf(entry: MajorEntry) {
        const refusal = gridRefusal(gameState, seat.playerId, entry.type)
        if (!refusal) return undefined
        const why: { parts: ReasonPart[]; text: string } =
            refusal.cause === 'engine'
                ? {
                      parts: gameSession.reasonParts(refusal.reason),
                      text: `${gameSession.humanizeReason(refusal.reason)}`
                  }
                : shortWhy(refusalWords(refusal))
        return { ...why, cardHelps: cardsMakingPossible(cards, entry.type).length > 0 }
    }

    function shortWhy(words: string): { parts: ReasonPart[]; text: string } {
        return { parts: [{ kind: 'text', text: words }], text: words }
    }

    // A dimmed major answers "why not" under the pointer, and on a tap, where there is no hover; a
    // tapped reason holds for the state and seat it was tapped in, and a hover on another tile
    // replaces it.
    let tap = $state.raw<{ entry: MajorEntry; seatId: string; actionCount: number } | undefined>(
        undefined
    )
    let tapped = $derived(
        tap && tap.seatId === seat.playerId && tap.actionCount === gameState.actionCount
            ? tap.entry
            : undefined
    )
    let hoveredEntry = $state.raw<ActionEntry | undefined>(undefined)
    let pointedMajor = $derived(tapped ?? MAJOR_ACTIONS.find((entry) => entry === hoveredEntry))
    let shownRefusal = $derived(
        pointedMajor && !available(pointedMajor) ? refusalOf(pointedMajor) : undefined
    )
    // The ring is read with the reason it answers.
    const reasonId = $props.id()
    function ringed(entry: ActionEntry): boolean {
        return entry.type === ActionType.UseActionPower && shownRefusal?.cardHelps === true
    }

    let freeActionDue = $derived(freeActionDueLine(gameState, seat.playerId))

    function send(type: ActionType) {
        if (type === ActionType.EndActPhase) void gameSession.endActPhase()
        else if (type === ActionType.SelfExile) void gameSession.selfExile()
    }

    // A pressed tile gives way to its panel without a pointer leave, so the line clears here.
    function take(entry: ActionEntry) {
        tap = undefined
        hoveredEntry = undefined
        if (UNTARGETED_ACTIONS.has(entry.type)) send(entry.type)
        else gameSession.chooseAction(entry.type)
    }

    function pressMajor(entry: MajorEntry, ok: boolean) {
        if (ok) take(entry)
        else tap = { entry, seatId: seat.playerId, actionCount: gameState.actionCount }
    }

    function hover(entry: ActionEntry, on: boolean) {
        if (on && tapped !== entry) tap = undefined
        if (on) hoveredEntry = entry
        else if (hoveredEntry === entry) hoveredEntry = undefined
    }

    function pointing(entry: ActionEntry) {
        return {
            disabled: busy,
            onpointerenter: () => hover(entry, true),
            onpointerleave: () => hover(entry, false),
            onfocus: () => hover(entry, true),
            onblur: () => hover(entry, false)
        }
    }
</script>

<div class="head flex items-center justify-between gap-2 mb-2">
    <h3 class="text-[11px] uppercase tracking-[0.2em] text-oath-heading">Supply {seat.supply}</h3>
    {#if valid.has(ActionType.EndActPhase)}
        <!-- R-4.2 — the phase may end after zero actions. -->
        <button
            class="shrink-0 rounded bg-oath-control hover:bg-oath-control-hover disabled:opacity-40
                   px-2 py-1 text-xs font-semibold"
            disabled={busy}
            onclick={() => send(ActionType.EndActPhase)}
        >
            End Act Phase
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
                Skip
            </button>
        {/if}
    </div>
{/if}

<div class="actions">
    <div class="majors flex flex-wrap gap-1.5">
        {#each MAJOR_ACTIONS as entry (entry.type)}
            {@const ok = available(entry)}
            {@const cost = tileCost(gameState, seat.playerId, entry)}
            {@const describe = `${entry.label} — ${cost}. ${entry.summary}`}
            <button
                class="group flex w-[92px] flex-col items-center gap-1 rounded border px-1
                       py-1.5 text-center transition-colors
                       {ok
                    ? 'border-oath-frame bg-oath-surface-raised hover:border-oath-accent hover:bg-oath-surface-raised cursor-pointer'
                    : 'border-oath-divider bg-oath-surface opacity-55 cursor-not-allowed'}"
                {...pointing(entry)}
                aria-disabled={!ok}
                title={ok ? describe : (refusalOf(entry)?.text ?? describe)}
                onclick={() => pressMajor(entry, ok)}
            >
                <img src={actionImage(entry.type)} alt="" class="h-9 w-9 {ok ? '' : 'grayscale'}" />
                <span class="text-[11px] font-semibold leading-none">{entry.label}</span>
                <span class="text-[10px] leading-none text-oath-accent">{cost}</span>
            </button>
        {/each}
    </div>

    {#if minors.length > 0}
        <div class="minors mt-1.5 flex flex-wrap gap-1.5">
            {#each minors as entry (entry.type)}
                {@const ring = ringed(entry)}
                <!-- The ring is drawn inside the chip's edge, so no parent can clip it. -->
                <button
                    class="rounded border bg-oath-surface-raised px-2 py-1 text-[11px] font-medium
                           transition-colors hover:border-oath-accent cursor-pointer
                           {ring
                        ? 'border-oath-accent text-oath-accent ring-1 ring-inset ring-oath-accent'
                        : 'border-oath-frame'}"
                    {...pointing(entry)}
                    aria-describedby={ring ? reasonId : undefined}
                    title={`${entry.label}. ${entry.summary}`}
                    onclick={() => take(entry)}
                >
                    {entry.label}
                </button>
            {/each}
        </div>
    {/if}
</div>

<!-- One fixed line: why the pointed or tapped major is refused, or what the hovered action does. -->
<div class="strip mt-1.5 min-h-[1.5rem] text-[11px] leading-snug">
    {#if shownRefusal}
        <span id={reasonId} class="text-oath-danger"
            >{#each shownRefusal.parts as part, i (i)}{#if part.kind === 'text'}<TokenText
                        text={part.text}
                    />{:else}<PlayerName
                        playerId={part.playerId}
                        possessive={part.possessive}
                    />{/if}{/each}</span
        >
    {:else if hoveredEntry}
        <span class="text-oath-text-muted"><TokenText text={hoveredEntry.summary} /></span>
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
