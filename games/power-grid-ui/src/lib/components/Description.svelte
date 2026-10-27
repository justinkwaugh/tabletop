<script lang="ts">
    import { PlayerName } from '@tabletop/frontend-components'
    import { gameMap } from '@tabletop/power-grid'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import type { Line } from '$lib/utils/describe.js'
    import Elektro from './actions/Elektro.svelte'
    import ResourceTally from './actions/ResourceTally.svelte'

    let { line }: { line: Line } = $props()

    const session = getGameSession()
    const names = $derived(
        new Map(gameMap(session.gameState.mapId).cities.map((city) => [city.id, city.name]))
    )
</script>

<span class="line"
    >{#each line as segment, index (index)}{#if segment.kind === 'text'}{segment.text}{:else if segment.kind === 'player'}<PlayerName
                playerId={segment.playerId}
            />{:else if segment.kind === 'plant'}<span class="plant">{segment.plant}</span
            >{:else if segment.kind === 'money'}<Elektro
                amount={segment.amount}
            />{:else if segment.kind === 'verb'}{segment.playerId === session.myPlayerId
                ? segment.second
                : segment.third}{:else if segment.kind === 'resources'}<ResourceTally
                amounts={segment.amounts}
            />{:else}<span class="city">{names.get(segment.cityId)}</span>{/if}{/each}</span
>

<style>
    .plant {
        font-family: 'Big Shoulders Stencil Display', sans-serif;
        font-weight: 800;
        background: #1b201b;
        border-radius: 3px;
        padding: 0 4px;
        color: #ecebe1;
    }
    .city {
        font-weight: 700;
    }
</style>
