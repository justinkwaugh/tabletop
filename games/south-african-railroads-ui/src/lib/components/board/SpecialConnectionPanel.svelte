<script lang="ts">
    import type { RailroadId } from '@tabletop/south-african-railroads'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { boardLayout } from '$lib/utils/boardLayout.js'
    import { RAILROAD_STYLE } from '$lib/utils/railroadStyle.js'
    import Cube from '../icons/Cube.svelte'

    const gameSession = getGameSession()

    const map = $derived(gameSession.gameState.map)
    const special = $derived(map.definition.specialConnection)
    const panel = $derived(boardLayout(map.id).specialConnection)
    const founders = $derived(gameSession.gameState.specialConnection ?? [])
    function names(railroadIds: readonly RailroadId[]): string[] {
        return railroadIds.map((railroadId) => map.railroad(railroadId).shortName)
    }
</script>

{#if special && panel}
    <g transform="translate({panel.x} {panel.y})" aria-label={special.name}>
        <title
            >Once a game, in place of a build, a railroad whose track meets one from the other side
            pays ${special.cost} to found the {special.name}</title
        >
        <rect width={panel.width} height={panel.height} rx="8" class="sheet" />
        <text x={panel.width / 2} y="22" class="title">The {special.name}</text>
        <line x1="12" x2={panel.width - 12} y1="31" y2="31" class="rule" />
        <text x={panel.width / 2} y="50" class="body"
            >{names(special.northern).join(' or ')} meets {names(special.southern).join(
                ' or '
            )}:</text
        >
        <text x={panel.width / 2} y="67" class="body"
            >pay ${special.cost} instead of building; both pay a</text
        >
        <text x={panel.width / 2} y="84" class="body"
            >special dividend and gain ${special.valueBonus} final value.</text
        >
        <text x="62" y="114" class="label">+{special.valueBonus} value</text>
        {#each [0, 1] as slot (slot)}
            {@const founder = founders[slot]}
            <rect x={150 + slot * 44} y="96" width="30" height="30" rx="3" class="slot" />
            {#if founder}
                {@const style = RAILROAD_STYLE[founder]}
                <Cube x={165 + slot * 44} y={112} size={24} color={style.fill} edge={style.dark} />
            {/if}
        {/each}
    </g>
{/if}

<style>
    .sheet {
        fill: #f7efd9;
        stroke: #384f6c;
        stroke-width: 2;
    }

    .title {
        font-family: 'SAR Oswald', 'Arial Narrow', sans-serif;
        font-size: 18px;
        font-weight: 500;
        letter-spacing: 0.06em;
        fill: #18222f;
        text-anchor: middle;
    }

    .rule {
        stroke: #577ba8;
        stroke-width: 1;
    }

    .body {
        font-family: 'Libre Baskerville', Georgia, serif;
        font-size: 12.5px;
        font-style: italic;
        fill: #28394d;
        text-anchor: middle;
    }

    .label {
        font-family: 'SAR Bitter', Georgia, serif;
        font-size: 14px;
        font-weight: 700;
        fill: #18222f;
        text-anchor: middle;
    }

    .slot {
        fill: #fbf5e3;
        stroke: #18222f;
        stroke-width: 1.5;
    }
</style>
