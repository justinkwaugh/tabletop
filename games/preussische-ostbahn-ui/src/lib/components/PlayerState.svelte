<script lang="ts">
    import { PlayerName } from '@tabletop/frontend-components'
    import { RAILROAD_IDS } from '@tabletop/preussische-ostbahn'
    import { assertExists } from '@tabletop/common'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import { RAILROAD_STYLES } from '$lib/utils/railroadStyle.js'

    let { playerId }: { playerId: string } = $props()

    const gameSession = getGameSession()
    const state = $derived(gameSession.gameState)
    const player = $derived(state.getPlayerState(playerId))
    const color = $derived(gameSession.colors.getPlayerUiColor(playerId))
    const textColor = $derived(gameSession.colors.getPlayerTextColorValue(playerId))
    const income = $derived(state.playerIncome(playerId))
    const holdings = $derived(
        RAILROAD_IDS.map((railroadId) => ({
            railroadId,
            count: state.sharesHeld(railroadId, playerId)
        })).filter(({ count }) => count > 0)
    )
    const cubes = $derived.by(() => {
        const entry = state.incomeCup().find((cup) => cup.playerId === playerId)
        assertExists(entry, `${playerId} has no place in the cup`)
        return entry.cubes
    })
</script>

<div class="passbook po-serif">
    <div class="cover" style:background={color} style:color={textColor}>
        <span class="holder"><PlayerName {playerId} /></span>
    </div>
    <div class="page">
        <div class="figures">
            <div class="figure">
                <span class="label">Cash</span>
                <span class="value">${player.cash}</span>
            </div>
            <div class="figure">
                <span class="label">Income</span>
                <span class="value">${income}</span>
            </div>
            <div class="figure">
                <span class="label">Next draw</span>
                <span class="draw" aria-label={`${cubes} cube${cubes === 1 ? '' : 's'}`}>
                    {#each Array.from({ length: cubes }, (_, index) => index) as index (index)}
                        <span class="cube" style:background={color}></span>
                    {/each}
                </span>
            </div>
        </div>
        <div class="footer">
            <div class="stamps">
                {#each holdings as holding (holding.railroadId)}
                    {@const style = RAILROAD_STYLES[holding.railroadId]}
                    {#each Array.from({ length: holding.count }, (_, index) => index) as index (index)}
                        <span class="stamp" style:background={style.fill} style:color={style.text}
                            >{style.initial}</span
                        >
                    {/each}
                {:else}
                    <span class="none">No shares</span>
                {/each}
            </div>
        </div>
    </div>
</div>

<style>
    .passbook {
        border-radius: 6px;
        background: var(--po-card);
        color: var(--po-ink);
        overflow: hidden;
    }

    .cover {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        padding: 5px 12px 4px;
        box-shadow: inset 0 -1.5px rgba(0, 0, 0, 0.22);
    }

    .holder {
        font-family: 'Ostbahn Alegreya', Georgia, serif;
        font-size: 18px;
        font-weight: 700;
    }

    .page {
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding: 8px 12px 10px;
    }

    .figures {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 8px;
    }

    .figure {
        display: flex;
        flex-direction: column;
        gap: 2px;
    }

    .label {
        font-size: 10px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--po-muted);
    }

    .value {
        font-family: 'Ostbahn Alegreya', Georgia, serif;
        font-size: 24px;
        font-weight: 700;
        line-height: 1;
    }

    .draw {
        display: flex;
        align-items: flex-end;
        gap: 4px;
        height: 24px;
        padding-bottom: 3px;
    }

    .cube {
        width: 14px;
        height: 14px;
        border-radius: 3px;
        box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.35);
    }

    .footer {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
    }

    .stamps {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
    }

    .stamp {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 28px;
        height: 22px;
        padding: 0 5px;
        border-radius: 4px;
        font-size: 12px;
        font-weight: 700;
    }

    .none {
        font-size: 12px;
        color: var(--po-muted);
        white-space: nowrap;
    }
</style>
