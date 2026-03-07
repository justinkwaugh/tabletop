<script lang="ts">
    import { type GameAction } from '@tabletop/common'
    import { PlayerName } from '@tabletop/frontend-components'
    import { INDONESIA_REGION_BY_AREA_ID, isGrowCity, isIndonesiaNodeId } from '@tabletop/indonesia'
    import { aggregateActions } from '$lib/utils/actionAggregator.js'
    import { getRegionName } from '$lib/definitions/regions.js'
    import ActionDescription from './ActionDescription.svelte'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'

    let gameSession = getGameSession()

    const lastAction = $derived.by(() => {
        const aggregated = Array.from(aggregateActions(gameSession.actions))
        return aggregated.at(-1)
    })

    function cityRegionNameForAction(action: GameAction | undefined): string | undefined {
        if (!action || !isGrowCity(action)) {
            return undefined
        }

        const city = gameSession.gameState.board.cities.find((entry) => entry.id === action.cityId)
        if (!city) {
            return undefined
        }

        if (!isIndonesiaNodeId(city.area)) {
            return undefined
        }

        const regionId = INDONESIA_REGION_BY_AREA_ID[city.area]
        if (!regionId) {
            return undefined
        }

        return getRegionName(regionId)
    }
</script>

<div class="history-last-action">
    {#if lastAction}
        <h1 class="history-last-action-line">
            {#if lastAction.playerId}
                <PlayerName
                    playerId={lastAction.playerId}
                    additionalClasses="tracking-[0.08em]"
                    capitalization="none"
                />
            {/if}
            <ActionDescription
                action={lastAction}
                justify="center"
                history={true}
                fullWidth={false}
                cityRegionName={cityRegionNameForAction(lastAction)}
            />
        </h1>
    {:else}
        <span class="history-last-action-fallback">Viewing history.</span>
    {/if}
</div>

<style>
    .history-last-action {
        width: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0 10px;
    }

    .history-last-action-line {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        width: 100%;
        margin: 0;
        font-size: 17px;
        line-height: 1.15;
        letter-spacing: 0.02em;
        font-weight: 500;
    }

    .history-last-action-fallback {
        font-size: 17px;
        line-height: 1.15;
        letter-spacing: 0.02em;
    }
</style>
