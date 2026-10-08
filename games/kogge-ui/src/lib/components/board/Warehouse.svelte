<script lang="ts">
    import { GOODS } from '@tabletop/kogge'
    import { WAREHOUSE_AREA } from '$lib/board/layout.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { GOOD_ART } from '$lib/utils/goodsArt.js'
    import Cartouche from './Cartouche.svelte'
    import GoodCube from '../art/GoodCube.svelte'
    import BonusChitArt from '../art/BonusChitArt.svelte'

    const gameSession = getGameSession()
    const supply = $derived(gameSession.gameState.supply)
    const bonusSupply = $derived(gameSession.gameState.bonusSupply)
</script>

<Cartouche area={WAREHOUSE_AREA} title="Warehouse">
    {#each GOODS as good, index (good)}
        <g transform="translate({20 + index * 59} 50)">
            <GoodCube {good} x={18} y={22} size={26} />
            <text x="18" y="62" text-anchor="middle" font-size="19" font-weight="700" fill="#2a1a0c"
                >{supply[good]}</text
            >
            <text
                x="18"
                y="78"
                text-anchor="middle"
                font-family="IM Fell English"
                font-style="italic"
                font-size="13"
                fill="#5b4027">{GOOD_ART[good].name}</text
            >
        </g>
    {/each}
    <path d="M24 150 H{WAREHOUSE_AREA.width - 24}" stroke="#8a6a3c" stroke-width="0.9"></path>
    {#each bonusSupply as chit, index (index)}
        <BonusChitArt
            {chit}
            x={18 + (index % 4) * 59}
            y={160 + Math.floor(index / 4) * 50}
            size={46}
        />
    {/each}
</Cartouche>
