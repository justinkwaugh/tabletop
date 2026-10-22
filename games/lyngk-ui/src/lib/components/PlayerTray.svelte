<script lang="ts">
    import { CLAIMS_PER_PLAYER, LyngkVariant, type HydratedLyngkPlayerState } from '@tabletop/lyngk'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import PieceIcon from './PieceIcon.svelte'
    import HeightIcon from './HeightIcon.svelte'

    let { playerState }: { playerState: HydratedLyngkPlayerState } = $props()

    const session = getGameSession()

    const isActive = $derived(session.gameState.activePlayerIds.includes(playerState.playerId))
    const isWinner = $derived(
        session.gameState.result !== undefined &&
            session.gameState.winningPlayerIds.includes(playerState.playerId)
    )
    // Scored stacks (or stacks of 5 on the board), then stacks of 4, 3, 2 and 1 topped by this
    // player's colors: the order the game is decided in.
    const ranking = $derived(session.gameState.rankingOf(playerState.playerId))
    const stackOfSix = $derived(session.gameState.variant === LyngkVariant.StackOfSix)
    // In the Stack of 6 variant a stack of 5 is incomplete too, and is counted on the board.
    const incomplete = $derived(
        (stackOfSix ? [5, 4, 3, 2, 1] : [4, 3, 2, 1]).map((height) => ({
            height,
            count: ranking[5 - height]
        }))
    )
</script>

<div class="tray" class:active={isActive}>
    <div
        class="flex items-center justify-between rounded-t-[10px] px-3 py-1 font-semibold"
        style:background={session.colors.getPlayerBgColorValue(playerState.playerId)}
        style:color={session.colors.getPlayerTextColorValue(playerState.playerId)}
    >
        <span class="truncate text-[17px]">{session.getPlayerName(playerState.playerId)}</span>
        <span class="text-[13px] tracking-[0.12em] uppercase">
            {#if isWinner}Winner{:else if isActive}Playing{/if}
        </span>
    </div>
    <div class="rows">
        <span class="label"
            >Colors <span class="of">({playerState.claimed.length} of {CLAIMS_PER_PLAYER})</span
            ></span
        >
        <span class="value">
            {#each playerState.claimed as color (color)}
                <PieceIcon stack={[color]} size={22} />
            {:else}
                <span class="quiet">none yet</span>
            {/each}
        </span>

        {#if !stackOfSix}
            <span class="label">
                Scored
                <span class="box number" title="Stacks of 5 scored"
                    ><span class="count">{ranking[0]}</span></span
                >
            </span>
            <span class="value">
                {#each playerState.scored as stack, index (index)}
                    <PieceIcon {stack} size={22} />
                {/each}
            </span>
        {/if}

        <span class="incomplete" class:wide={stackOfSix}>
            <span class="label">Incomplete</span>
            <span class="value boxes">
                {#each incomplete as { height, count } (height)}
                    <span class="box" title="Stacks of {height} topped by your colors">
                        <HeightIcon {height} size={18} />
                        <span class="count">{count}</span>
                    </span>
                {/each}
            </span>
        </span>
    </div>
</div>

<style>
    /* Light enough for black pieces to stand out as well as ivory ones. */
    .tray {
        border-radius: 12px;
        background: #c9d6e8;
        box-shadow:
            inset 0 0 0 1px #8fa5c4,
            0 3px 8px rgb(0 0 0 / 0.3);
        color: #0d1626;
        overflow: hidden;
    }

    .tray.active {
        box-shadow:
            inset 0 0 0 2px var(--lyngk-target),
            0 3px 8px rgb(0 0 0 / 0.35);
    }

    .rows {
        display: grid;
        grid-template-columns: 7.1rem 1fr;
        grid-auto-rows: minmax(30px, auto);
        align-items: center;
        column-gap: 6px;
        row-gap: 4px;
        padding: 8px 12px 10px;
        font-size: 15px;
    }

    .label {
        font-weight: 600;
        white-space: nowrap;
    }

    .of {
        font-size: 13px;
        font-weight: 500;
        color: #45577a;
    }

    .value {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 6px;
    }

    /* The label and boxes share the grid's columns; with five boxes (Stack of 6) the row takes
       the card's full width instead. */
    .incomplete {
        display: contents;
    }

    .incomplete.wide {
        grid-column: 1 / -1;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 6px;
    }

    .boxes {
        flex-wrap: nowrap;
        gap: 4px;
    }

    .box {
        display: inline-flex;
        align-items: flex-end;
        gap: 3px;
        padding: 2px 5px 2px 3px;
        border-radius: 6px;
        background: rgb(255 255 255 / 0.45);
        box-shadow: inset 0 0 0 1px #8fa5c4;
    }

    .box.number {
        margin-left: 4px;
        padding: 1px 7px;
        vertical-align: middle;
    }

    .count {
        font-weight: 700;
        font-variant-numeric: tabular-nums;
        line-height: 1.1;
    }

    .quiet {
        color: #45577a;
    }
</style>
