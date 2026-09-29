<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import CityIcon from './icons/CityIcon.svelte'
    import RoadIcon from './icons/RoadIcon.svelte'

    const gameSession = getGameSession()

    const player = $derived(gameSession.myPlayerState)
    const allowance = $derived(gameSession.resupplyAllowance)

    let roads = $state(0)
    let cities = $state(0)

    const total = $derived(roads + cities)
    const rows = $derived([
        {
            key: 'roads',
            value: roads,
            staged: player?.stagingRoads ?? 0,
            set: (value: number) => (roads = value)
        },
        {
            key: 'cities',
            value: cities,
            staged: player?.stagingCities ?? 0,
            set: (value: number) => (cities = value)
        }
    ])
</script>

<div class="picker">
    {#each rows as row (row.key)}
        <div class="row">
            {#if row.key === 'roads'}
                <RoadIcon size={26} />
            {:else}
                <CityIcon size={26} />
            {/if}
            <button
                type="button"
                class="step"
                aria-label="Fewer"
                disabled={row.value === 0}
                onclick={() => row.set(row.value - 1)}>−</button
            >
            <span class="value">{row.value}</span>
            <button
                type="button"
                class="step"
                aria-label="More"
                disabled={row.value >= row.staged || total >= allowance}
                onclick={() => row.set(row.value + 1)}>+</button
            >
            <span class="staged">of {row.staged}</span>
        </div>
    {/each}
    <button
        type="button"
        class="confirm"
        disabled={total === 0}
        onclick={() => gameSession.resupply(roads, cities)}
    >
        Move {total} of {allowance} to supply
    </button>
</div>

<style>
    .picker {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: center;
        gap: 14px;
        padding: 4px 10px;
        border-radius: 12px;
        background: rgba(255, 250, 235, 0.8);
        box-shadow: inset 0 0 0 1px rgba(107, 63, 29, 0.25);
    }

    .row {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 15px;
    }

    .step {
        width: 26px;
        height: 26px;
        border-radius: 999px;
        border: 1.5px solid rgba(107, 63, 29, 0.55);
        line-height: 1;
    }

    .step:disabled,
    .confirm:disabled {
        opacity: 0.35;
    }

    .value {
        min-width: 16px;
        text-align: center;
        font-weight: 700;
    }

    .staged {
        font-size: 13px;
        color: #8c6a45;
    }

    .confirm {
        border-radius: 999px;
        padding: 3px 12px;
        background: #6b3f1d;
        color: #fbf3dc;
        font-size: 15px;
    }
</style>
