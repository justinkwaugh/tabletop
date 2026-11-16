<script lang="ts">
    import CompanyToken from '../tokens/CompanyToken.svelte'
    import { remainingStationTokens } from './stationTokens.js'
    import type { EighteenXXSessionView } from '../session/eighteenXXSession.svelte.js'
    let {
        session,
        companyId,
        vertical = false
    }: {
        session: EighteenXXSessionView
        companyId: string
        /** A narrow card groups the tokens by cost, each group's count beside its token. */
        vertical?: boolean
    } = $props()
    const money = $derived(session.presentation.money)
    const stationCosts = $derived(!session.presentation.hideStationCosts)
    const tokens = $derived(
        remainingStationTokens(session.gameState, companyId, (stationId) =>
            session.stations.placementCost(stationId)
        )
    )
    const remainingStations = $derived(tokens.remaining)
    const tokenGroups = $derived(tokens.groups)
    const counted = $derived(tokens.counted)
    const appearance = (neutral: boolean) =>
        (neutral ? session.mapView.neutralStation : undefined) ??
        session.mapView.stations[companyId]
    const label = (neutral: boolean) => (neutral ? 'Neutral station token' : 'Station token')
</script>

<div class="remaining-tokens" role="group" aria-label="Remaining station tokens">
    {#if !vertical}
        {#each remainingStations as station (station.id)}
            {@const cost = session.stations.placementCost(station.id)}
            <div
                class="token-cost"
                aria-label={stationCosts
                    ? `${label(station.neutral)}, ${money(cost)}`
                    : label(station.neutral)}
            >
                <CompanyToken appearance={appearance(station.neutral)} size={20} />
                {#if stationCosts}<span>{cost}</span>{/if}
            </div>
        {/each}
    {:else}
        {#each tokenGroups as group (`${group.neutral}:${group.cost}`)}
            <div
                class="token-cost"
                aria-label={stationCosts
                    ? `${group.count} ${group.neutral ? 'neutral ' : ''}station tokens, ${money(group.cost)} each`
                    : `${group.count} ${group.neutral ? 'neutral ' : ''}station tokens`}
            >
                <div class="token-count">
                    {#if counted}<span>{group.count}</span>{/if}<CompanyToken
                        appearance={appearance(group.neutral)}
                        size={20}
                    />
                </div>
                {#if stationCosts}<span class="token-price">{group.cost}</span>{/if}
            </div>
        {:else}
            <div class="token-count exhausted" aria-label="0 station tokens remaining">
                <span>0</span><CompanyToken
                    appearance={session.mapView.stations[companyId]}
                    size={20}
                />
            </div>
        {/each}
    {/if}
</div>

<style>
    .remaining-tokens {
        display: flex;
        gap: 6px;
    }
    .token-count {
        display: flex;
        align-items: center;
        gap: 3px;
        font-size: 16px;
        line-height: 20px;
    }
    .token-price {
        align-self: flex-end;
        width: 20px;
        text-align: center;
    }
    .token-count.exhausted {
        opacity: 0.45;
        filter: grayscale(1);
    }
    .token-cost {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 2px;
        font-size: 11px;
        line-height: 11px;
        font-variant-numeric: tabular-nums;
        color: var(--rail-text, #695540);
    }
</style>
