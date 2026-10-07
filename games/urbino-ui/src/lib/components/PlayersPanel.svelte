<script lang="ts">
    import { getGameSession } from '$lib/model/sessionContext.svelte'
    import { PlayerName } from '@tabletop/frontend-components'
    import { BuildingType, computeDistrictScores } from '@tabletop/urbino'
    import { TablePalette, isDarkColor, woodFill } from '$lib/theme.js'
    import PieceIcon from './PieceIcon.svelte'

    const session = getGameSession()
    const state = $derived(session.gameState)

    const liveScores = $derived(computeDistrictScores(state.board, state.monumentsVariant))

    const SUPPLY = [
        { type: BuildingType.House, singular: 'house', plural: 'houses', start: 18, columns: 9 },
        { type: BuildingType.Palace, singular: 'palace', plural: 'palaces', start: 6, columns: 6 },
        { type: BuildingType.Tower, singular: 'tower', plural: 'towers', start: 3, columns: 3 }
    ]

    const PIECE_SIZE = 19

    const MONUMENTS = [
        { name: 'Town Wall', sequence: [BuildingType.House, BuildingType.House, BuildingType.House], pts: 6 },
        { name: 'Ducal Palace', sequence: [BuildingType.Palace, BuildingType.House, BuildingType.Palace], pts: 10 },
        { name: 'Cathedral', sequence: [BuildingType.Tower, BuildingType.Palace, BuildingType.Tower], pts: 16 }
    ]

    function remaining(player: (typeof state.players)[number], type: BuildingType): number {
        if (type === BuildingType.House) return player.houses
        if (type === BuildingType.Palace) return player.palaces
        return player.towers
    }
</script>

<div class="flex flex-col gap-4 p-3">
    {#each state.players as player (player.playerId)}
        {@const uiColor = session.colors.getPlayerUiColor(player.playerId)}
        {@const active = state.activePlayerIds.includes(player.playerId)}
        <div class="player" class:active>
            <div
                class="flex items-center gap-2 px-3 py-2"
                style:background={woodFill(uiColor)}
                style:color={session.colors.getPlayerTextColorValue(player.playerId)}
            >
                <PlayerName
                    playerId={player.playerId}
                    backgroundOpacity={0}
                    additionalClasses="!p-0 urbino-display !text-[23px] leading-tight tracking-[0.04em]"
                />
                {#if active}
                    <span class="urbino-display rounded-full bg-black/15 px-2 text-[10px] tracking-[0.16em]">BUILDING</span>
                {/if}
                <span class="ml-auto flex items-baseline gap-1">
                    <span class="urbino-display text-[26px] leading-none">{liveScores.get(player.playerId) ?? 0}</span>
                    <span class="text-[13px] opacity-75">pts</span>
                </span>
            </div>
            <div
                class="tray grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-2 px-3 py-2.5"
                class:light-tray={isDarkColor(uiColor)}
            >
                {#each SUPPLY as supply (supply.type)}
                    {@const left = remaining(player, supply.type)}
                    <div class="grid gap-[2px]" style:grid-template-columns="repeat({supply.columns}, {PIECE_SIZE}px)">
                        {#each { length: supply.start } as _, slot (slot)}
                            {#if slot < left}
                                <PieceIcon
                                    buildingType={supply.type}
                                    color={uiColor}
                                    buildingStyle={session.buildingStyle}
                                    size={PIECE_SIZE}
                                />
                            {:else}
                                <span class="spent" style:width="{PIECE_SIZE}px" style:height="{PIECE_SIZE}px"></span>
                            {/if}
                        {/each}
                    </div>
                    <div class="flex w-[4.4rem] flex-col items-center gap-[3px]">
                        <span class="supply-count urbino-display text-[18px] leading-none text-(--cream)">{left}</span>
                        <span class="supply-label urbino-display text-[9.5px] leading-none tracking-[0.12em] text-(--cream-quiet) uppercase">
                            {left === 1 ? supply.singular : supply.plural}
                        </span>
                    </div>
                {/each}
            </div>
        </div>
    {/each}

    {#if state.monumentsVariant}
        <div class="urbino-plank rounded-lg border-2 border-(--maple-edge) p-3 shadow-[0_3px_8px_rgb(0_0_0/0.35)]">
            <div class="urbino-display mb-2 text-[14px] tracking-[0.16em]">MONUMENTS</div>
            <div class="flex flex-col gap-1.5">
                {#each MONUMENTS as monument (monument.name)}
                    <div class="flex items-center gap-2">
                        <div class="flex gap-0.5">
                            {#each monument.sequence as type, i (i)}
                                <PieceIcon
                                    buildingType={type}
                                    color={TablePalette.mapleDeep}
                                    buildingStyle={session.buildingStyle}
                                    size={22}
                                />
                            {/each}
                        </div>
                        <span class="text-[16px]">{monument.name}</span>
                        <span class="urbino-display ml-auto text-[15px]">{monument.pts}</span>
                    </div>
                {/each}
            </div>
        </div>
    {/if}
</div>

<style>
    .player {
        overflow: hidden;
        border-radius: 10px;
        border: 2px solid var(--slate-edge);
        box-shadow: 0 3px 8px rgb(0 0 0 / 0.35);
        transition:
            border-color 200ms,
            box-shadow 200ms;
    }

    .player.active {
        border-color: var(--gold);
        box-shadow:
            0 0 0 1px var(--gold),
            0 0 14px color-mix(in oklab, var(--gold) 55%, transparent),
            0 3px 8px rgb(0 0 0 / 0.35);
    }

    .tray {
        background: linear-gradient(180deg, #26313b, #2d3a46);
        box-shadow: inset 0 3px 6px rgb(0 0 0 / 0.45);
    }

    .tray.light-tray {
        background: var(--maple-plank);
        box-shadow: inset 0 3px 6px rgb(60 30 0 / 0.35);
    }

    .light-tray .spent {
        background-color: rgb(60 30 0 / 0.14);
        box-shadow: inset 0 0 0 1px rgb(60 30 0 / 0.12);
    }

    .light-tray :global(.supply-count) {
        color: var(--ink);
    }

    .light-tray :global(.supply-label) {
        color: var(--ink-quiet);
    }

    .spent {
        display: block;
        padding: 3px;
        background-clip: content-box;
        border-radius: 3px;
        background-color: rgb(0 0 0 / 0.2);
        box-shadow: inset 0 0 0 1px rgb(255 255 255 / 0.06);
    }
</style>
