<script lang="ts">
    import { ACTION_SPACES, ActionSpace } from '@tabletop/hill-country-grocers'
    import { getGameSession } from '$lib/model/sessionContext.svelte.js'
    import {
        ACTION_BOARD_Y,
        ACTION_BOX_HEIGHT,
        ACTION_BOX_WIDTH,
        actionBoxX
    } from '$lib/utils/boardLayout.js'
    import { SPACE_NAMES } from '$lib/utils/describeAction.js'
    import PlayerToken from '../icons/PlayerToken.svelte'

    const gameSession = getGameSession()

    const boxes = $derived(
        ACTION_SPACES.map((space) => ({
            space,
            x: actionBoxX(space),
            pawns: gameSession.gameState.players.filter((player) => player.actionSpace === space),
            selectable: gameSession.selectableSpaces.includes(space)
        }))
    )

    function onKey(event: KeyboardEvent, space: ActionSpace) {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            void gameSession.chooseSpace(space)
        }
    }
</script>

{#snippet boxContent(entry: (typeof boxes)[number])}
    <rect width={ACTION_BOX_WIDTH} height={ACTION_BOX_HEIGHT} rx="10" class="panel" />
    <path
        d="M0 10 Q0 0 10 0 L{ACTION_BOX_WIDTH - 10} 0 Q{ACTION_BOX_WIDTH} 0 {ACTION_BOX_WIDTH} 10 L{ACTION_BOX_WIDTH} 34 L0 34 Z"
        class="band"
    />
    <text x={ACTION_BOX_WIDTH / 2} y="23" class="title">{SPACE_NAMES[entry.space]}</text>
    {#each entry.pawns as player, index (player.playerId)}
        <PlayerToken
            x={ACTION_BOX_WIDTH / 2 + (index - (entry.pawns.length - 1) / 2) * 38}
            y={57}
            color={gameSession.colors.getPlayerUiColor(player.playerId)}
            textColor={gameSession.colors.getPlayerTextColorValue(player.playerId)}
            initial={gameSession.getPlayerName(player.playerId).charAt(0).toUpperCase()}
        />
    {/each}
{/snippet}

{#each boxes as entry (entry.space)}
    {#if entry.selectable}
        <g
            transform="translate({entry.x} {ACTION_BOARD_Y})"
            class="selectable"
            role="button"
            tabindex="0"
            aria-label="Choose {SPACE_NAMES[entry.space]}"
            onclick={() => gameSession.chooseSpace(entry.space)}
            onkeydown={(event) => onKey(event, entry.space)}
        >
            {@render boxContent(entry)}
        </g>
    {:else}
        <g transform="translate({entry.x} {ACTION_BOARD_Y})">
            {@render boxContent(entry)}
        </g>
    {/if}
{/each}

<style>
    .panel {
        fill: #fdf8ec;
        stroke: #7a1d22;
        stroke-width: 2;
    }

    .band {
        fill: #7a1d22;
    }

    .selectable {
        cursor: pointer;
        outline: none;
    }

    .selectable .panel {
        fill: #fff3c4;
        stroke: #c8961a;
        stroke-width: 4;
    }

    .selectable:hover .panel,
    .selectable:focus-visible .panel {
        fill: #ffe796;
    }

    .title {
        font-family: 'Libre Baskerville', Georgia, serif;
        font-size: 17px;
        font-weight: 700;
        fill: #fdf3dc;
        text-anchor: middle;
    }

</style>
