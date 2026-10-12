<script lang="ts">
    import { PlayerName } from '@tabletop/frontend-components'
    import type { WarbandGroup } from '@tabletop/oath'
    import TokenRow from '$lib/components/TokenRow.svelte'
    import { warbandFigure } from '$lib/images/pieceImages.js'
    import { tappedCount } from '$lib/model/exchangeTerms.js'
    import { siteName } from '$lib/model/names.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    // R-10.22 — a row of warband pieces per group, each label beside its pieces in one column at
    // the widest label's width: "at <Site>", "on your board", or another player's board by their
    // chip ("to ..." where the warbands go there). A tap on the Nth piece sets N, a tap on the count
    // sets 0; a row never goes past `ceilingAt`. With `per` 2 the pieces go in pairs (Blood Pact),
    // the row's buttons counting pairs while `counts`, `ceilingAt` and `onpick` stay in warbands.
    let {
        groups,
        order = groups.map((_, index) => index),
        counts,
        ceilingAt,
        onpick,
        tone,
        per = 1,
        toward = false,
        ownerWord = new Set(groups.map((group) => group.owner)).size > 1
    }: {
        groups: readonly WarbandGroup[]
        /** The rows' order, by index in `groups`; `counts` and the callbacks keep those indices. */
        order?: readonly number[]
        counts: readonly number[]
        ceilingAt: (index: number) => number
        onpick: (index: number, count: number) => void
        /** Rose where the picked warbands die; gold where they move. */
        tone: 'gold' | 'rose'
        per?: 1 | 2
        /** The rows name where the warbands go, not where they stand. */
        toward?: boolean
        /** A row names its owner; by default when the groups mix owners (a battle's force). */
        ownerWord?: boolean
    } = $props()

    let gameSession = getGameSession()
    let busy = $derived(gameSession.busy)

    function isMine(playerId: string): boolean {
        return gameSession.myPlayer?.id === playerId
    }

    let atSite = $derived(toward ? 'to' : 'at')
    let onBoard = $derived(toward ? 'to' : 'on')

    /** For a piece's screen-reader name; the row shows another player's board as their chip. */
    function whereText(group: WarbandGroup): string {
        if (group.at.kind === 'site') {
            return `${atSite} ${siteName(gameSession.gameState, group.at.siteId)}`
        }
        const board = isMine(group.at.playerId)
            ? 'your board'
            : `${gameSession.getPlayerName(group.at.playerId)}'s board`
        return `${onBoard} ${board}`
    }
</script>

<div class="mb-1 grid grid-cols-[max-content_auto] items-center gap-x-2.5 gap-y-1">
    {#each order as index (index)}
        {@const group = groups[index]}
        {@const count = counts[index] ?? 0}
        {@const owner = ownerWord ? `${gameSession.warbandOwnerName(group.owner)} ` : ''}
        <span>
            {#if group.at.kind === 'board' && !isMine(group.at.playerId)}
                {owner}{onBoard}
                <PlayerName playerId={group.at.playerId} possessive /> board
            {:else}
                {owner}{whereText(group)}
            {/if}
        </span>
        <TokenRow
            image={warbandFigure(gameSession.warbandColor(group.owner))}
            held={group.count}
            addable={Math.floor(ceilingAt(index) / per)}
            picked={Math.floor(count / per)}
            label={(n) => `${n * per} of the ${owner}warbands ${whereText(group)}`}
            ontap={(n) => onpick(index, tappedCount(count, n * per))}
            {tone}
            {per}
            {busy}
        />
    {/each}
</div>
