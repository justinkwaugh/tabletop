<script lang="ts">
    import { sunray } from '@tabletop/feudum'
    import type { Snippet } from 'svelte'
    import EpochSky from '$lib/components/tracks/EpochSky.svelte'
    import RegionStacks from '$lib/components/tracks/RegionStacks.svelte'
    import VoyageService from '$lib/components/tracks/VoyageService.svelte'
    import WineBarrels from '$lib/components/tracks/WineBarrels.svelte'
    import SeatToken from '$lib/components/pieces/SeatToken.svelte'
    import { seatOrder } from '$lib/model/seatPanel.js'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import Scrim from './Scrim.svelte'

    /** Contract, Phone layout: the tracks, scattered round the board, redrawn in one column. */
    let { onClose }: { onClose: () => void } = $props()

    const SheetShare = 80
    const DiscSize = 28
    const ChartShare = 40

    const gameSession = getGameSession()
    let state = $derived(gameSession.gameState)
    let round = $derived(state.roundManager.currentRound?.number ?? 1)

    const { paintOf } = gameSession

    let scores = $derived(
        seatOrder(state).map((playerId) => ({
            playerId,
            name: gameSession.getPlayerName(playerId),
            paint: paintOf(playerId),
            score: gameSession.seatPanel(playerId).ribbon.score
        }))
    )
</script>

{#snippet track(title: string, name: string, viewBox: string, drawing: Snippet, share = 100)}
    <section data-track={name}>
        <h3 class="text-xs uppercase tracking-wide text-feudum-text-muted">{title}</h3>
        <svg class="block h-auto" style:width="{share}%" {viewBox} pointer-events="none">
            {@render drawing()}
        </svg>
    </section>
{/snippet}

{#snippet sky()}
    <EpochSky {state} printed={false} />
{/snippet}
{#snippet stacks()}
    <RegionStacks {state} printed={false} />
{/snippet}
{#snippet barrels()}
    <WineBarrels {state} printed={false} {paintOf} />
{/snippet}
{#snippet voyageAndService()}
    <VoyageService {state} printed={false} {paintOf} />
{/snippet}

<Scrim label="the tracks" layer="tracks" {onClose} sheet={SheetShare}>
    <div
        class="flex flex-col gap-3 px-2 pb-3 pt-3 text-feudum-text"
        style:font-family="var(--feudum-font-text)"
        data-tracks-sheet
    >
        <p class="pr-14 text-sm font-semibold" data-tracks-epoch>
            Epoch {sunray(state.epoch).ray} · Round {round}
        </p>
        {@render track('Epoch', 'epoch', '760 60 356 146', sky)}
        {@render track('Region tiles and die', 'stacks-west', '930 806 320 94', stacks)}
        {@render track('Region tiles', 'stacks-east', '1254 806 270 94', stacks)}
        {@render track('Region tile chart', 'chart', '1594 762 104 128', stacks, ChartShare)}
        {@render track('Krud barrels', 'barrels', '1750 770 280 124', barrels)}
        {@render track('Epic voyage', 'voyage', '1584 56 446 108', voyageAndService)}
        {@render track('Military service', 'service', '640 806 300 94', voyageAndService)}
        <section data-track="score">
            <h3 class="text-xs uppercase tracking-wide text-feudum-text-muted">Score</h3>
            {#each scores as { playerId, name, paint, score } (playerId)}
                <div class="flex items-center gap-2 py-1 text-sm" data-track-score={playerId}>
                    <svg width={DiscSize} height={DiscSize} viewBox="0 0 {DiscSize} {DiscSize}">
                        <SeatToken kind="disc" {paint} size={DiscSize} />
                    </svg>
                    <span class="truncate">{name}</span>
                    <span class="ml-auto font-bold">{score} vp</span>
                </div>
            {/each}
        </section>
    </div>
</Scrim>
