<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { laneBetween } from '$lib/utils/lanes.js'

    const gameSession = getGameSession()

    const lanes = $derived(
        gameSession.gameState.cities.flatMap((city) =>
            city.routes.flatMap((slot, index) =>
                slot.value === undefined || slot.value === city.number
                    ? []
                    : [
                          {
                              key: `${city.number}-${index}`,
                              lane: laneBetween(city.number, slot.value)
                          }
                      ]
            )
        )
    )
</script>

<g pointer-events="none">
    {#each lanes as { key, lane } (key)}
        <path
            d={lane.path}
            fill="none"
            stroke="#f6fbf6"
            stroke-opacity="0.16"
            stroke-width="7"
            stroke-linecap="round"
        ></path>
        <path
            d={lane.path}
            fill="none"
            stroke="#4a7f80"
            stroke-opacity="0.18"
            stroke-width="1"
            stroke-dasharray="2 7"
            stroke-linecap="round"
        ></path>
    {/each}
</g>
