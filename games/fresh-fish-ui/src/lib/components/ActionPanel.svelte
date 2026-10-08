<script lang="ts">
    import { ActionType, isEndAuction } from '@tabletop/fresh-fish'
    import WoodStall from '$lib/components/WoodStall.svelte'
    import WoodMarket from '$lib/components/WoodMarket.svelte'
    import TiltedTile from '$lib/components/TiltedTile.svelte'
    import { UNCLAIMED_STALL } from '$lib/utils/pieceColors.js'
    import Disk from '$lib/components/Disk.svelte'
    import BagIcon from '$lib/components/BagIcon.svelte'
    import { getGameSession } from '$lib/model/gameSessionContext.svelte.js'

    let gameSession = getGameSession()
    let bidValue = $state(0)
    let playerState = $derived.by(() =>
        gameSession.gameState.players.find((p) => p.playerId === gameSession.myPlayer?.id)
    )

    let windowHeight: number | null | undefined = $state()

    async function chooseAction(action: string) {
        switch (action) {
            case ActionType.DrawTile:
                const drawTileAction = gameSession.createDrawTileAction()
                await gameSession.applyAction(drawTileAction)
                break
            default:
                gameSession.chosenAction = action
                break
        }
    }

    async function placeBid() {
        const placeBidAction = gameSession.createPlaceBidAction(bidValue)
        await gameSession.applyAction(placeBidAction)
        bidValue = 0
    }

    let showActions = $derived(!gameSession.chosenAction)

    const instructions = $derived.by(() => {
        if (!gameSession.chosenAction) {
            return 'Choose an action'
        }

        switch (gameSession.chosenAction) {
            case ActionType.PlaceBid:
                return 'Place your bid'
            case ActionType.PlaceDisk:
                return 'Please place a disc'
            case ActionType.PlaceStall:
                return 'Please place your stall'
            case ActionType.PlaceMarket:
                return 'Please place the market'
            default:
                return ''
        }
    })

    let previewSize = $derived(windowHeight && windowHeight > 700 ? 84 : 56)

    let wonFor = $derived.by(() => {
        if (gameSession.chosenAction !== ActionType.PlaceStall) return undefined
        const auction = gameSession.actions.findLast((action) => isEndAuction(action))
        return auction && isEndAuction(auction) ? auction.highBid : undefined
    })

    let myColor = $derived(gameSession.colors.getPlayerUiColor(gameSession.myPlayer?.id))

    const hint = $derived.by(() => {
        switch (gameSession.chosenAction) {
            case ActionType.PlaceBid:
                return `You have $${playerState?.money ?? 0} to spend`
            case ActionType.PlaceStall:
            case ActionType.PlaceMarket:
                return 'Choose a reserved space'
            default:
                return undefined
        }
    })

    function incrementBid() {
        bidValue = Math.min(bidValue + 1, playerState?.money ?? 0)
    }

    function decrementBid() {
        bidValue = Math.max(bidValue - 1, 0)
    }
</script>

<svelte:window bind:innerHeight={windowHeight} />

<div
    class="mb-2 flex flex-row justify-center items-center gap-6 rounded-md px-5 py-2.5 bg-gray-200 text-gray-900 dark:bg-gray-800 dark:text-gray-100"
>
    {#if gameSession.chosenAction === ActionType.PlaceBid || gameSession.chosenAction === ActionType.PlaceStall}
        <div class="relative">
            <TiltedTile>
                <WoodStall
                    size={previewSize}
                    color={gameSession.chosenAction === ActionType.PlaceStall
                        ? myColor
                        : UNCLAIMED_STALL}
                    goodsType={gameSession.gameState.getChosenStallType()}
                />
            </TiltedTile>
            {#if wonFor !== undefined}
                <span class="price-stamp" style:--tile={previewSize} title="Won for ${wonFor}"
                    >${wonFor}</span
                >
            {/if}
        </div>
    {/if}
    {#if gameSession.chosenAction === ActionType.PlaceMarket}
        <TiltedTile>
            <WoodMarket size={previewSize} />
        </TiltedTile>
    {/if}
    <div class="flex flex-col justify-center items-center">
        <h1 class="text-lg font-semibold leading-tight">{instructions}</h1>
        {#if hint}
            <p class="text-sm text-gray-600 dark:text-gray-400">{hint}</p>
        {/if}
        {#if gameSession.chosenAction === ActionType.PlaceBid}
            <div class="flex flex-row justify-center items-center gap-3 my-1">
                <button class="choice step" onclick={decrementBid} disabled={bidValue <= 0}
                    >&minus;</button
                >
                <span class="w-[64px] text-center text-3xl font-semibold tabular-nums"
                    >${bidValue}</span
                >
                <button
                    class="choice step"
                    onclick={incrementBid}
                    disabled={bidValue >= (playerState?.money ?? 0)}>+</button
                >
            </div>
        {/if}
        <div class="flex flex-row justify-center items-center gap-2 mt-1.5">
            {#if showActions}
                {#each gameSession.validActionTypes as action (action)}
                    <button class="choice" onclick={async () => chooseAction(action)}>
                        {#if action === ActionType.DrawTile}
                            <span class="icon"><BagIcon size={32} /></span>
                        {:else if action === ActionType.PlaceDisk}
                            <span class="icon"><Disk color={myColor} size={32} /></span>
                        {/if}
                        <span class="label">{gameSession.nameForActionType(action)}</span>
                    </button>
                {/each}
            {/if}
            {#if gameSession.chosenAction === ActionType.PlaceBid}
                <button
                    class="choice confirm"
                    style:--confirm-bg={myColor}
                    style:--confirm-text={gameSession.colors.getPlayerTextColorValue(
                        gameSession.myPlayer?.id
                    )}
                    onclick={async () => placeBid()}
                >
                    Bid ${bidValue}
                </button>
            {/if}
        </div>
    </div>
</div>

<style>
    .price-stamp {
        /* Sized from the tile: 84px tile → 17px text. */
        --u: calc(var(--tile) * 1px / 84);
        position: absolute;
        top: calc(-5 * var(--u));
        right: calc(-4 * var(--u));
        transform: rotate(-4deg);
        min-width: calc(34 * var(--u));
        padding: calc(3 * var(--u)) calc(7 * var(--u)) calc(2 * var(--u));
        border-radius: 999px;
        font-family: var(--ff-label-font, inherit);
        font-size: calc(17 * var(--u));
        line-height: 1;
        text-align: center;
        color: var(--ff-label);
        background: var(--ff-tray);
        box-shadow:
            0 0 0 calc(2 * var(--u)) var(--ff-label),
            0 3px 6px rgba(0, 0, 0, 0.45);
    }
    .choice {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        min-height: 36px;
        padding: 4px 14px;
        border-radius: 6px;
        border: 1px solid #c4c9d1;
        background: #ffffff;
        color: #111827;
        font-size: 0.95rem;
        font-weight: 500;
    }
    .choice:hover:not(:disabled) {
        background: #f3f4f6;
    }
    .choice:has(.icon) {
        padding-left: 6px;
    }
    .choice:disabled {
        opacity: 0.4;
        cursor: not-allowed;
    }
    :global(.dark) .choice {
        border-color: #4b5563;
        background: #374151;
        color: #f3f4f6;
    }
    :global(.dark) .choice:hover:not(:disabled) {
        background: #4b5563;
    }
    /* Trim the icons' built-in margins so they sit close to their label. */
    .icon {
        display: flex;
        margin: -4px -2px -4px 0;
    }
    /* Optically centre the label: cap height sits a little high in the line box. */
    .label {
        position: relative;
        top: 1px;
    }
    .choice.step {
        width: 36px;
        padding: 0;
        justify-content: center;
        font-size: 1.25rem;
    }
    .choice.confirm,
    :global(.dark) .choice.confirm,
    .choice.confirm:hover:not(:disabled),
    :global(.dark) .choice.confirm:hover:not(:disabled) {
        border-color: rgba(0, 0, 0, 0.3);
        background: var(--confirm-bg);
        color: var(--confirm-text);
        font-weight: 600;
    }
</style>
