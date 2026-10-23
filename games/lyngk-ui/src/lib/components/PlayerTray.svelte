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
    // Standard scores stacks of 5 off the board, so the strip holds only the tie-breaks; in
    // Stack of 6 the stacks of 5 are still on the board and lead the strip.
    const counts = $derived(
        (stackOfSix ? [5, 4, 3, 2, 1] : [4, 3, 2, 1]).map((height) => ({
            height,
            count: ranking[5 - height]
        }))
    )
    const openClaims = $derived(CLAIMS_PER_PLAYER - playerState.claimed.length)
</script>

<div class="tray" class:active={isActive}>
    <div
        class="flex items-center gap-2 rounded-t-[10px] px-3 py-1 font-semibold"
        style:background={session.colors.getPlayerBgColorValue(playerState.playerId)}
        style:color={session.colors.getPlayerTextColorValue(playerState.playerId)}
    >
        <span class="truncate text-[17px]">{session.getPlayerName(playerState.playerId)}</span>
        <span
            class="claims"
            title="Colors claimed ({playerState.claimed.length} of {CLAIMS_PER_PLAYER})"
        >
            {#each playerState.claimed as color (color)}
                <PieceIcon stack={[color]} size={24} />
            {/each}
            {#each { length: openClaims }, index (index)}
                <span class="open-claim"></span>
            {/each}
        </span>
        <span class="ms-auto text-[13px] tracking-[0.12em] whitespace-nowrap uppercase">
            {#if isWinner}Winner{:else if isActive}Playing{/if}
        </span>
    </div>
    {#if !stackOfSix}
        <div class="scored" title="Stacks scored">
            {#each playerState.scored as stack, index (index)}
                <PieceIcon {stack} size={28} />
            {/each}
        </div>
    {/if}
    <div class="strip">
        <span class="caption">{stackOfSix ? 'Stacks' : 'Tie-break'}</span>
        {#each counts as { height, count } (height)}
            <span class="part" title="Stacks of {height} topped by your colors">
                <HeightIcon {height} size={16} />
                <strong>{count}</strong>
            </span>
        {/each}
    </div>
</div>

<style>
    /* Light enough for black pieces to stand out as well as ivory ones. */
    .tray {
        --ring: 1px;
        border-radius: 12px;
        background: #c9d6e8;
        box-shadow:
            inset 0 0 0 var(--ring) #8fa5c4,
            0 3px 8px rgb(0 0 0 / 0.3);
        color: #0d1626;
        overflow: hidden;
    }

    .tray.active {
        --ring: 2px;
        box-shadow:
            inset 0 0 0 var(--ring) var(--lyngk-target),
            0 3px 8px rgb(0 0 0 / 0.35);
    }

    /* A light slot on the player's color, so black and ivory pieces both show. */
    .claims {
        display: flex;
        flex-shrink: 0;
        align-items: center;
        gap: 4px;
        padding: 2px 6px;
        border-radius: 999px;
        background: #c9d6e8;
    }

    .open-claim {
        width: 24px;
        height: 16px;
        border-radius: 50%;
        border: 2px dashed #7d93b4;
    }

    .scored {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 6px;
        min-height: 46px;
        padding: 8px 12px;
    }

    .strip {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 6px;
        padding: calc(5px - var(--ring) / 2) 12px calc(5px + var(--ring) / 2);
        background: rgb(13 22 38 / 0.06);
        color: #45577a;
    }

    .scored + .strip {
        border-top: 1px solid rgb(13 22 38 / 0.12);
    }

    .caption {
        font-size: 10px;
        font-weight: 600;
        letter-spacing: 0.1em;
        text-transform: uppercase;
    }

    .part {
        display: inline-flex;
        align-items: flex-end;
        gap: 3px;
    }

    .part strong {
        font-size: 15px;
        line-height: 1.1;
        color: #0d1626;
        font-variant-numeric: tabular-nums;
    }
</style>
