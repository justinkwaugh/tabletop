<script lang="ts">
    import { PlayerName } from '@tabletop/frontend-components'
    import { cityInfo } from '@tabletop/kogge'
    import type { Story } from '$lib/utils/story.js'
    import { addressReader } from '$lib/utils/agreement.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import ShieldIcon from './ShieldIcon.svelte'
    import GoodsList from './GoodsList.svelte'

    let { story }: { story: Story } = $props()
    const gameSession = getGameSession()
</script>

<span class="story">
    {#each story as part, index (index)}
        {#if part.kind === 'text'}{part.text}{:else if part.kind === 'agree'}{part.playerId ===
            gameSession.myPlayerId
                ? addressReader(part.text)
                : part.text}{:else if part.kind === 'player'}<PlayerName
                playerId={part.playerId}
            />{:else if part.kind === 'city'}<span class="city">{cityInfo(part.city).name}</span
            >{:else if part.kind === 'markers'}<span class="inline-flex gap-0.5 align-middle"
                >{#each part.values as value, slot (slot)}<ShieldIcon
                        {value}
                        size={18}
                    />{/each}</span
            >{:else}<GoodsList goods={part.goods} />{/if}
    {/each}
</span>

<style>
    .city {
        font-family: 'IM Fell English SC', serif;
        font-size: 1.05em;
    }
</style>
