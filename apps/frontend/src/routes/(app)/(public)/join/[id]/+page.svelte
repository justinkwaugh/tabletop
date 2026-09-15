<script lang="ts">
    import { goto } from '$app/navigation'
    import { getAppContext } from '$lib/stores/appContext.svelte'
    import { getLoginModal } from '$lib/stores/loginModal'
    import { clearLoginContinuation, saveLoginContinuation } from '$lib/utils/loginContinuation'
    import { gamePlayPath, publicGameInvitationPath } from '$lib/utils/publicGameInvitation'
    import { gameCardOptions } from '$lib/utils/gameOptions'
    import { gameCardAppearance } from '$lib/utils/gameCardAppearance'
    import { playerSortValue, playerStatusDisplay } from '$lib/utils/player'
    import { findPlayerForUserId, GameStatus, PlayerStatus, UserStatus } from '@tabletop/common'
    import { Alert, Button, Card } from 'flowbite-svelte'
    import { toast } from 'svelte-sonner'
    import type { PageData } from './$types'

    let { data }: { data: PageData } = $props()
    const { api, authorizationService, catalogService, gameService } = getAppContext()
    const openLoginModal = getLoginModal()
    let game = $derived(data.game)
    let user = $derived(authorizationService.getSessionUser())
    let title = $derived(catalogService.entries.find((entry) => entry.id === game?.typeId))
    let player = $derived(game && user ? findPlayerForUserId(game, user.id) : undefined)
    let joined = $derived(player?.status === PlayerStatus.Joined)
    let openSeats = $derived(
        game?.players.filter((seat) => seat.status === PlayerStatus.Open).length ?? 0
    )
    let canJoin = $derived(
        game?.status === GameStatus.WaitingForPlayers &&
            !joined &&
            (openSeats > 0 || player?.status === PlayerStatus.Reserved)
    )
    let players = $derived.by(() => {
        if (!game) return []
        const { players, ownerId } = game
        return players.toSorted((a, b) => playerSortValue(a, ownerId) - playerSortValue(b, ownerId))
    })
    let options = $derived(game ? gameCardOptions(game.config, game.configOptions) : [])
    let joining = $state(false)
    let joinError = $state('')

    $effect(() => {
        if (game?.status !== GameStatus.Started && game?.status !== GameStatus.Finished) return
        toast.info(
            game.status === GameStatus.Started
                ? 'This game has already started. Opening the game…'
                : 'This game has finished. Opening the game…'
        )
        void goto(gamePlayPath(game.id), { replaceState: true })
    })

    async function join() {
        if (!game || !canJoin || joining) return
        if (user?.status !== UserStatus.Active) {
            saveLoginContinuation(publicGameInvitationPath(game.id))
            if (user) {
                await goto('/onboarding')
            } else {
                openLoginModal()
            }
            return
        }
        joining = true
        joinError = ''
        try {
            await gameService.joinGame(game.id)
            await goto('/dashboard')
        } catch {
            joinError =
                'Unable to join. The game may have changed; check the available seats and try again.'
            try {
                game = await api.getPublicGamePreview(game.id)
            } catch {
                joinError = 'Unable to reach the game. Please try again.'
            }
        } finally {
            joining = false
        }
    }
</script>

<svelte:head>
    <title>{game ? `Join ${game.name}` : 'Game invitation'} · Board Together</title>
</svelte:head>

<main class="mx-auto flex max-w-lg flex-col items-center gap-4 px-4 py-10">
    <Card size="md" class={`w-full p-4 sm:p-6 gap-4 ${gameCardAppearance}`}>
        {#if game}
            <p class="text-sm font-medium text-blue-700 dark:text-blue-300">
                Public game invitation
            </p>
            <div class="flex items-center gap-4">
                {#if title}
                    <img
                        src={title.thumbnailUrl}
                        alt={title.metadata.name}
                        class="h-20 w-20 shrink-0 object-contain"
                    />
                {/if}
                <div>
                    <h1 class="text-lg font-light leading-5 text-gray-900 dark:text-gray-200">
                        {game.name}
                    </h1>
                    <p class="mt-2 text-xs text-gray-600 dark:text-gray-400">{game.titleName}</p>
                </div>
            </div>
            <p class="text-xs text-gray-600 dark:text-gray-400">
                {game.players.length} players · {openSeats} open {openSeats === 1
                    ? 'seat'
                    : 'seats'}
            </p>
            {#if options.length}
                <h2 class="text-xs font-semibold uppercase text-gray-600 dark:text-gray-400">
                    Game options
                </h2>
                <dl class="-mt-3 divide-y divide-gray-200 dark:divide-gray-700">
                    {#each options as option (option.name)}
                        <div
                            class="flex justify-between gap-4 py-2 text-xs text-gray-600 dark:text-gray-400"
                        >
                            <dt>{option.name}</dt>
                            <dd>{option.value}</dd>
                        </div>
                    {/each}
                </dl>
            {/if}
            <h2 class="text-xs font-semibold uppercase text-gray-600 dark:text-gray-400">
                Players
            </h2>
            <ul class="-mt-3 divide-y divide-gray-200 dark:divide-gray-700">
                {#each players as seat (seat.id)}
                    <li
                        class="flex justify-between gap-4 py-2 text-sm text-gray-600 dark:text-gray-400"
                    >
                        <span>{seat.status === PlayerStatus.Open ? 'Open seat' : seat.name}</span>
                        <span class="text-sm text-gray-500 dark:text-gray-400"
                            >{playerStatusDisplay(seat, game.ownerId)}</span
                        >
                    </li>
                {/each}
            </ul>
            {#if joined}
                <Alert color="green">You’ve joined this game.</Alert>
                <Button
                    href={game.status === GameStatus.Started ? gamePlayPath(game.id) : '/dashboard'}
                    >Go to game</Button
                >
            {:else if !canJoin}
                <Alert color="blue"
                    >{game.status === GameStatus.Started
                        ? 'This game has already started.'
                        : game.status === GameStatus.Finished
                          ? 'This game has finished.'
                          : 'There are no open seats in this game.'}</Alert
                >
            {/if}
            {#if joinError}<Alert color="red" role="alert">{joinError}</Alert>{/if}
        {:else}
            <h1 class="text-2xl font-semibold text-gray-900 dark:text-white">
                {data.loadFailed ? 'Unable to load game' : 'Invitation unavailable'}
            </h1>
            <p class="text-gray-600 dark:text-gray-300">
                {data.loadFailed
                    ? 'Please check your connection and try again.'
                    : 'This game no longer exists or is no longer public.'}
            </p>
        {/if}
        <div class="flex justify-end gap-3 border-t border-gray-200 pt-4 dark:border-gray-700">
            <Button
                size="sm"
                color="light"
                href={user?.status === UserStatus.Active ? '/activeGamesCheck' : '/#games'}
                onclick={clearLoginContinuation}
                disabled={joining}>No thanks</Button
            >
            {#if canJoin}
                <Button size="sm" color="green" disabled={joining} onclick={join}
                    >{joining ? 'Joining…' : 'Join'}</Button
                >
            {/if}
        </div>
    </Card>
</main>
