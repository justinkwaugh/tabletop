<script lang="ts">
    import { PlayerName } from '@tabletop/frontend-components'
    import { BUILDING_POINTS, BuildingStyle, BuildingType } from '@tabletop/urbino'
    import { getGameSession } from '$lib/model/sessionContext.svelte'
    import { entryContaining, historyEntries } from '$lib/history/historyEntries.js'
    import HistoryEntryLine from './HistoryEntryLine.svelte'
    import PieceIcon from './PieceIcon.svelte'
    import PawnIcon from './PawnIcon.svelte'

    const session = getGameSession()
    const gameState = $derived(session.gameState)

    let concedeConfirming = $state(false)

    const buildingTypes = [BuildingType.House, BuildingType.Palace, BuildingType.Tower]
    const buildingName: Record<BuildingType, string> = {
        [BuildingType.House]: 'House',
        [BuildingType.Palace]: 'Palace',
        [BuildingType.Tower]: 'Tower'
    }

    const myPlayerState = $derived(gameState.players.find((p) => p.playerId === session.myPlayer?.id))
    const myColor = $derived(session.colors.getPlayerUiColor(session.myPlayer?.id))

    const entries = $derived(historyEntries(session.actions))
    const historyEntry = $derived(
        session.isViewingHistory ? entryContaining(entries, session.currentActionIndex) : undefined
    )
    const latestEntry = $derived(entries.at(-1))

    function remaining(type: BuildingType): number {
        if (!myPlayerState) return 0
        if (type === BuildingType.House) return myPlayerState.houses
        if (type === BuildingType.Palace) return myPlayerState.palaces
        return myPlayerState.towers
    }

    function unplaceableReason(type: BuildingType, count: number): string {
        const name = buildingName[type].toLowerCase()
        return count === 0
            ? `You have no ${name}s left`
            : `No square both architects can see allows a ${name} here`
    }

    const prompt = $derived.by(() => {
        if (session.isPlacingArchitects) {
            return gameState.architectsPlaced === 0
                ? 'Place the first architect on any square'
                : 'Place the second architect on any empty square'
        }
        if (session.canChooseFirstPlayer) return 'Choose who builds first'
        if (session.selectedArchitectIndex !== undefined) {
            return `Choose where architect ${session.selectedArchitectIndex + 1} moves`
        }
        if (session.selectedBuildingType) {
            return `Build the ${buildingName[session.selectedBuildingType].toLowerCase()} where both architects can see`
        }
        if (session.canPass) return 'Neither architect can see a square you may build on — you must pass'
        if (session.canPlaceBuilding && session.canRepositionArchitect) {
            return 'Choose a building, or first move an architect'
        }
        if (session.canPlaceBuilding) return 'Choose a building'
        if (session.canRepositionArchitect) return 'Move an architect to open up a place to build'
        return ''
    })
</script>

<div class="urbino-plank action-area flex min-h-[64px] flex-col justify-center gap-2 border-b-2 border-(--maple-edge) px-4 py-2.5 max-sm:px-3">
    {#if session.isViewingHistory}
        <div class="text-[19px] leading-snug font-medium max-sm:text-[17px]">
            {#if historyEntry}
                <HistoryEntryLine entry={historyEntry} viewerId={session.myPlayer?.id} />
            {:else}
                <span class="text-(--ink-quiet)">The game begins on an empty board.</span>
            {/if}
        </div>
    {:else if !session.isMyTurn}
        <div class="flex flex-col gap-0.5 text-[19px] leading-snug max-sm:text-[17px]">
            <div class="font-semibold text-(--ink)">
                Waiting for <PlayerName
                    playerId={gameState.activePlayerIds[0]}
                    backgroundOpacity={0}
                    additionalClasses="!p-0 !text-(--ink) font-bold"
                />
                {#if session.isPlacingArchitects}
                    to place an architect
                {:else if session.isChoosingFirstPlayer}
                    to choose who builds first
                {:else}
                    to build
                {/if}
            </div>
            {#if latestEntry}
                <div class="text-[17px] font-medium">
                    <span class="urbino-display mr-1 text-[11px] tracking-[0.14em] text-(--ink-quiet)">LAST</span>
                    <HistoryEntryLine entry={latestEntry} viewerId={session.myPlayer?.id} />
                </div>
            {/if}
        </div>
    {:else}
        <div class="text-[19px] leading-snug font-semibold text-(--ink) max-sm:text-[17px]">{prompt}</div>

        {#if session.canChooseFirstPlayer}
            <div class="flex flex-wrap gap-2">
                {#each gameState.players as player (player.playerId)}
                    <button class="choice" onclick={() => session.chooseFirstPlayer(player.playerId)}>
                        <PieceIcon
                            buildingType={BuildingType.Tower}
                            color={session.colors.getPlayerUiColor(player.playerId)}
                            buildingStyle={BuildingStyle.TowerRoofs}
                            size={20}
                        />
                        {player.playerId === session.myPlayer?.id ? 'I build' : `${session.getPlayerName(player.playerId)} builds`}
                        first
                    </button>
                {/each}
            </div>
        {/if}

        {#if session.canPlaceBuilding || session.canRepositionArchitect || session.canPass || session.canConcede}
            <div class="flex flex-wrap items-center gap-2">
                {#if session.canPlaceBuilding}
                    {#each buildingTypes as type (type)}
                        {@const count = remaining(type)}
                        {@const placeable = session.placeableBuildingTypes.has(type)}
                        <button
                            class="choice"
                            class:selected={session.selectedBuildingType === type}
                            disabled={!placeable}
                            title={placeable ? undefined : unplaceableReason(type, count)}
                            aria-pressed={session.selectedBuildingType === type}
                            onclick={() => session.selectBuildingType(type)}
                        >
                            <PieceIcon buildingType={type} color={myColor} buildingStyle={session.buildingStyle} size={26} />
                            <span class="flex flex-col items-start leading-none">
                                <span class="urbino-display text-[13px] tracking-[0.08em]">{buildingName[type]}</span>
                                <span class="text-[13px] text-(--ink-quiet) max-sm:hidden">
                                    {#if placeable}
                                        {BUILDING_POINTS[type]} pt · {count} left
                                    {:else}
                                        {count === 0 ? 'none left' : 'no legal square'}
                                    {/if}
                                </span>
                            </span>
                        </button>
                    {/each}
                {/if}

                {#if session.canRepositionArchitect}
                    {#each [0, 1] as idx (idx)}
                        {#if session.architectsWithValidMoves.has(idx)}
                            <button
                                class="choice"
                                class:selected={session.selectedArchitectIndex === idx}
                                aria-pressed={session.selectedArchitectIndex === idx}
                                onclick={() => session.selectArchitect(idx)}
                            >
                                <PawnIcon size={22} />
                                <span class="urbino-display text-[13px] tracking-[0.08em]"
                                    ><span class="max-sm:hidden">Move architect&nbsp;</span>{idx + 1}</span
                                >
                            </button>
                        {/if}
                    {/each}
                {/if}

                {#if session.canPass}
                    <button class="choice" onclick={() => session.pass()}>
                        <span class="urbino-display text-[13px] tracking-[0.08em]">Pass</span>
                    </button>
                {/if}

                {#if session.canConcede}
                    <div class="ml-auto flex items-center gap-2">
                        {#if concedeConfirming}
                            <span class="font-medium text-(--ink)">Concede the game?</span>
                            <button class="quiet danger" onclick={() => session.concede()}>Yes, concede</button>
                            <button class="quiet" onclick={() => (concedeConfirming = false)}>Cancel</button>
                        {:else}
                            <button class="quiet" onclick={() => (concedeConfirming = true)}>Concede</button>
                        {/if}
                    </div>
                {/if}
            </div>
        {/if}
    {/if}
</div>

<style>
    .action-area {
        box-shadow: 0 4px 10px rgb(0 0 0 / 0.25);
    }

    .choice {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 5px 12px 5px 8px;
        border-radius: 8px;
        border: 1.5px solid color-mix(in oklab, var(--maple-edge) 80%, transparent);
        background: color-mix(in oklab, var(--maple-light) 70%, white);
        color: var(--ink);
        box-shadow: 0 1px 0 rgb(255 255 255 / 0.6) inset, 0 1px 2px rgb(60 30 0 / 0.2);
        transition:
            background-color 120ms,
            box-shadow 120ms,
            transform 120ms;
    }

    @media (max-width: 639px) {
        .choice {
            gap: 5px;
            padding: 3px 9px 3px 5px;
        }
    }

    .choice:hover:not(:disabled) {
        background: white;
        transform: translateY(-1px);
    }

    .choice.selected {
        border-color: var(--gold-deep);
        background: #fff6dc;
        box-shadow:
            0 0 0 2px var(--gold),
            0 2px 6px rgb(60 30 0 / 0.3);
    }

    .choice:disabled {
        opacity: 0.45;
        cursor: not-allowed;
    }

    .quiet {
        padding: 3px 10px;
        border-radius: 6px;
        color: var(--ink-quiet);
        font-size: 15px;
    }

    .quiet:hover {
        background: rgb(0 0 0 / 0.08);
        color: var(--ink);
    }

    .quiet.danger {
        background: #8f2a1c;
        color: #fbeedd;
    }

    .quiet.danger:hover {
        background: #74200f;
    }
</style>
