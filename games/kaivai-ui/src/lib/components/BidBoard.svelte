<script lang="ts">
    import { getContext } from 'svelte'
    import type { KaivaiGameSession } from '$lib/model/KaivaiGameSession.svelte'
    import bidding from '$lib/images/bidding.png'
    import { uiBgColorForPlayer } from '$lib/utils/playerColors'
    let gameSession = getContext('gameSession') as KaivaiGameSession

    type BidData = {
        bid: number
        playerId?: string
        left: string
    }

    const bidData: BidData[] = $derived.by(() => {
        const data: BidData[] = [
            {
                bid: 1,
                left: 'left-[143px]'
            },
            {
                bid: 2,
                left: 'left-[230px]'
            },
            {
                bid: 3,
                left: 'left-[319px]'
            },
            {
                bid: 4,
                left: 'left-[407px]'
            },
            {
                bid: 5,
                left: 'left-[497px]'
            },
            {
                bid: 6,
                left: 'left-[587px]'
            },
            {
                bid: 7,
                left: 'left-[675px]'
            },
            {
                bid: 8,
                left: 'left-[765px]'
            },
            {
                bid: 9,
                left: 'left-[854px]'
            },
            {
                bid: 10,
                left: 'left-[944px]'
            }
        ]

        for (const [playerId, bid] of Object.entries(gameSession.gameState.bids)) {
            if (bid > 0 && bid <= 10) {
                data[bid - 1].playerId = playerId
            }
        }
        return data
    })

    async function placeBid(bid: number) {
        const action = gameSession.createPlaceBidAction(bid)
        gameSession.applyAction(action)
        gameSession.resetAction()
    }
</script>

<div class="relative flex flex-col justify-center items-center w-full rounded-lg overflow-hidden">
    <img class="z-0" src={bidding} alt="bidding" />
    {#each bidData as bid}
        <div
            role="button"
            tabindex={bid.playerId ? -1 : 0}
            onfocus={() => {}}
            onkeypress={() => {
                if (!bid.playerId) {
                    placeBid(bid.bid)
                }
            }}
            onclick={() => {
                if (!bid.playerId) {
                    placeBid(bid.bid)
                }
            }}
            class="absolute z-10 cursor-pointer rounded-full {bid.playerId
                ? `${uiBgColorForPlayer(gameSession.getPlayerColor(bid.playerId))}`
                : 'bg-transparent'} top-[30px] {bid.left} w-[60px] h-[60px] flex flex-col justify-center items-center"
        ></div>
    {/each}
</div>
