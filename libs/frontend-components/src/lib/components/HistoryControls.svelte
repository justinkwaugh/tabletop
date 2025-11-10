<script lang="ts">
    import { getContext } from 'svelte'
    import type { GameSession } from '$lib/model/gameSession.svelte'
    import { UserSolid } from 'flowbite-svelte-icons'
    import type { GameState, HydratedGameState } from '@tabletop/common'

    let {
        enabledColor = 'text-white',
        disabledColor = 'text-gray-700'
    }: { enabledColor?: string; disabledColor?: string } = $props()

    let gameSession = getContext('gameSession') as GameSession<GameState, HydratedGameState>

    let hasPriorPlayerAction = $derived.by(() => {
        if (!gameSession.myPlayer) {
            return false
        }
        return gameSession.history.playerHasPriorTurn(gameSession.myPlayer.id)
    })

    let hasFuturePlayerAction = $derived.by(() => {
        if (!gameSession.myPlayer) {
            return false
        }
        return gameSession.history.playerHasFutureTurn(gameSession.myPlayer.id)
    })

    async function goToMyPreviousTurn() {
        if (!gameSession.myPlayer) {
            return
        }
        await gameSession.history.goToPlayersPreviousTurn(gameSession.myPlayer.id)
    }

    async function goToMyNextTurn() {
        if (!gameSession.myPlayer) {
            return
        }
        await gameSession.history.goToPlayersNextTurn(gameSession.myPlayer.id)
    }
</script>

<div class="w-full flex flex-row justify-between items-center">
    <button
        onclick={async () => await goToMyPreviousTurn()}
        class="flex flex-row justify-center items-center {hasPriorPlayerAction
            ? enabledColor
            : disabledColor}"
    >
        <svg
            class="-me-1 w-[12px] h-[12px]"
            aria-hidden="true"
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            fill="currentColor"
            viewBox="0 0 24 24"
        >
            <g transform="translate(24,24) rotate(180)">
                <path
                    fill-rule="evenodd"
                    d="M8.6 5.2A1 1 0 0 0 7 6v12a1 1 0 0 0 1.6.8l8-6a1 1 0 0 0 0-1.6l-8-6Z"
                    clip-rule="evenodd"
                ></path>
            </g>
        </svg>
        <UserSolid size="lg" />
    </button>

    <div class="flex flex-row justify-center items-center space-x-2">
        <button
            aria-label="goto my last turn"
            onclick={async () => await gameSession.history.goToBeginning()}
            ><svg
                class="w-[25px] h-[25px] {gameSession.history.hasPreviousAction
                    ? enabledColor
                    : disabledColor}"
                aria-hidden="true"
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                fill="currentColor"
                viewBox="0 0 24 24"
            >
                <path
                    fill-rule="evenodd"
                    d="M7 6a1 1 0 0 1 2 0v4l6.4-4.8A1 1 0 0 1 17 6v12a1 1 0 0 1-1.6.8L9 14v4a1 1 0 1 1-2 0V6Z"
                    clip-rule="evenodd"
                ></path>
            </svg>
        </button>
        <button
            aria-label="step backwards"
            onclick={async () => await gameSession.history.goToPreviousAction()}
            ><svg
                class="w-[24px] h-[24px] {gameSession.history.hasPreviousAction
                    ? enabledColor
                    : disabledColor}"
                aria-hidden="true"
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                fill="none"
                viewBox="0 0 24 24"
            >
                <path
                    stroke="currentColor"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="m15 19-7-7 7-7"
                ></path>
            </svg>
        </button>
        <button
            aria-label="play history"
            onclick={async () => await gameSession.history.playHistory()}
            class={gameSession.history.playing ? 'hidden' : ''}
            ><svg
                class="w-[25px] h-[25px] {gameSession.actions.length === 0
                    ? disabledColor
                    : enabledColor}"
                aria-hidden="true"
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                fill="currentColor"
                viewBox="0 0 24 24"
            >
                <path
                    fill-rule="evenodd"
                    d="M8.6 5.2A1 1 0 0 0 7 6v12a1 1 0 0 0 1.6.8l8-6a1 1 0 0 0 0-1.6l-8-6Z"
                    clip-rule="evenodd"
                ></path>
            </svg>
        </button>
        <button
            aria-label="stop history playback"
            onclick={async () => await gameSession.history.stopHistoryPlayback()}
            class={!gameSession.history.playing ? 'hidden' : ''}
        >
            <svg
                class="w-[25px] h-[25px] {enabledColor}"
                aria-hidden="true"
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                fill="currentColor"
                viewBox="0 0 24 24"
            >
                <path
                    fill-rule="evenodd"
                    d="M8 5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H8Zm7 0a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-1Z"
                    clip-rule="evenodd"
                ></path>
            </svg>
        </button>
        <button
            aria-label="step forwards"
            onclick={async () => await gameSession.history.goToNextAction()}
            ><svg
                class="w-[24px] h-[24px] {gameSession.history.hasNextAction
                    ? enabledColor
                    : disabledColor}"
                aria-hidden="true"
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                fill="none"
                viewBox="0 0 24 24"
            >
                <path
                    stroke="currentColor"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="m9 5 7 7-7 7"
                ></path>
            </svg>
        </button>
        <button
            aria-label="go to current"
            onclick={async () => await gameSession.history.goToEnd()}
        >
            <svg
                class="w-[25px] h-[25px] {gameSession.history.hasNextAction
                    ? enabledColor
                    : disabledColor}"
                aria-hidden="true"
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                fill="currentColor"
                viewBox="0 0 24 24"
            >
                <path
                    fill-rule="evenodd"
                    d="M17 6a1 1 0 1 0-2 0v4L8.6 5.2A1 1 0 0 0 7 6v12a1 1 0 0 0 1.6.8L15 14v4a1 1 0 1 0 2 0V6Z"
                    clip-rule="evenodd"
                ></path>
            </svg>
        </button>
    </div>
    <button
        onclick={async () => await goToMyNextTurn()}
        class="flex flex-row justify-center items-center {hasFuturePlayerAction
            ? enabledColor
            : disabledColor}"
    >
        <UserSolid size="lg" />
        <svg
            class="-ms-1 w-[12px] h-[12px]"
            aria-hidden="true"
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            fill="currentColor"
            viewBox="0 0 24 24"
        >
            <path
                fill-rule="evenodd"
                d="M8.6 5.2A1 1 0 0 0 7 6v12a1 1 0 0 0 1.6.8l8-6a1 1 0 0 0 0-1.6l-8-6Z"
                clip-rule="evenodd"
            ></path>
        </svg>
    </button>
</div>
