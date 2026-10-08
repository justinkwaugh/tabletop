<script lang="ts">
    import { MARKET_AREA } from '$lib/board/layout.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import Cartouche from './Cartouche.svelte'
    import RouteShield from '../art/RouteShield.svelte'
    import TargetFrame from './TargetFrame.svelte'

    const gameSession = getGameSession()
    const offer = $derived(gameSession.gameState.offer)
    const GROUP_WIDTH = 176
    const GROUP_HEIGHT = 100
</script>

<Cartouche area={MARKET_AREA} title="Route markers for sale">
    {#each Array.from({ length: 4 }, (_, index) => index) as index (index)}
        {@const group = offer[index]}
        {@const x = 22 + (index % 2) * (GROUP_WIDTH + 14)}
        {@const y = 48 + Math.floor(index / 2) * (GROUP_HEIGHT + 10)}
        <g transform="translate({x} {y})">
            <rect width={GROUP_WIDTH} height={GROUP_HEIGHT} rx="4" fill="#e6d6ad" stroke="#7a5b33"
            ></rect>
            {#if group && group.boughtBy === undefined}
                {#each group.markers as marker, slot (slot)}
                    <RouteShield value={marker} x={24 + slot * 70} y={14} size={60} />
                {/each}
            {:else if group?.boughtBy}
                <text
                    x={GROUP_WIDTH / 2}
                    y={GROUP_HEIGHT / 2 + 6}
                    text-anchor="middle"
                    font-family="IM Fell English"
                    font-style="italic"
                    font-size="17"
                    fill="#6b4f2c">bought by {gameSession.getPlayerName(group.boughtBy)}</text
                >
            {/if}
            {#if gameSession.marketTargets.includes(index)}
                <TargetFrame
                    width={GROUP_WIDTH}
                    height={GROUP_HEIGHT}
                    target={{
                        label: 'Buy this pair for one good',
                        select: () => gameSession.chooseOfferGroup(index)
                    }}
                />
            {/if}
        </g>
    {/each}
</Cartouche>
