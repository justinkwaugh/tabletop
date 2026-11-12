<script lang="ts">
    import { PlayerName } from '@tabletop/frontend-components'
    import type { WarbandLocation } from '@tabletop/oath'
    import { ChoiceWidth } from '$lib/model/choiceWidth.svelte.js'
    import { siteName } from '$lib/model/names.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    let {
        label,
        places,
        picked,
        onpick,
        busy
    }: {
        /** The pick's few words before the buttons ("the warband you sacrifice:"). */
        label: string
        places: readonly WarbandLocation[]
        /** The index in `places` of the one picked, if any. */
        picked: number | undefined
        onpick: (index: number) => void
        busy: boolean
    } = $props()

    let gameSession = getGameSession()
    const width = new ChoiceWidth()

    function isMine(playerId: string): boolean {
        return gameSession.myPlayer?.id === playerId
    }

    function placeText(at: WarbandLocation): string {
        if (at.kind === 'site') return `at ${siteName(gameSession.gameState, at.siteId)}`
        return isMine(at.playerId)
            ? 'on your board'
            : `on ${gameSession.getPlayerName(at.playerId)}'s board`
    }
</script>

<!-- R-10.22 — a place in a force is a button: "at <Site>", "on your board", or another player's
     board by their chip, as WarbandGroupRows names them; as wide as the widest beside it, 44 px
     tall on a phone. -->
<div class="flex flex-wrap items-center gap-2 text-xs" role="group" aria-label={label}>
    <span class="text-oath-text-muted">{label}</span>
    {#each places as at, index (index)}
        {@const on = picked === index}
        <button
            type="button"
            class="inline-flex items-center justify-center rounded-md border px-2 py-[3px] text-sm
                   disabled:opacity-40 max-sm:min-h-11 {on
                ? 'border-oath-accent ring-2 ring-oath-accent'
                : 'border-oath-frame bg-oath-surface'}"
            aria-pressed={on}
            aria-label={placeText(at)}
            disabled={busy}
            onclick={() => onpick(index)}
        >
            <span class="flex justify-center" style:min-width="{width.widest}px">
                <span class="w-max" {@attach width.measure}>
                    {#if at.kind === 'board' && !isMine(at.playerId)}
                        on <PlayerName playerId={at.playerId} possessive /> board
                    {:else}
                        {placeText(at)}
                    {/if}
                </span>
            </span>
        </button>
    {/each}
</div>
