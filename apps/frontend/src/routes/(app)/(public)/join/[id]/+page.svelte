<script lang="ts">
    import { goto } from '$app/navigation'
    import { getAppContext } from '$lib/stores/appContext.svelte'
    import { getLoginModal } from '$lib/stores/loginModal'
    import { clearLoginContinuation, saveLoginContinuation } from '$lib/utils/loginContinuation'
    import { gamePlayPath, publicGameInvitationPath } from '$lib/utils/gameLinks'
    import { gameCardOptions } from '$lib/utils/gameOptions'
    import { gameCardAppearance } from '$lib/utils/gameCardAppearance'
    import { playersHostFirst, playerStatusDisplay } from '$lib/utils/player'
    import { findPlayerForUserId, GameStatus, PlayerStatus, UserStatus } from '@tabletop/common'
    import { Alert, Button, Card } from 'flowbite-svelte'
    import { toast } from 'svelte-sonner'
    import { m } from '$lib/paraglide/messages'
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
        return playersHostFirst(game.players, game.ownerId)
    })
    let options = $derived(game ? gameCardOptions(game.config, game.configOptions) : [])
    let joining = $state(false)
    let joinError = $state('')

    $effect(() => {
        if (game?.status !== GameStatus.Started && game?.status !== GameStatus.Finished) return
        toast.info(
            game.status === GameStatus.Started
                ? m.auth_join_started_opening()
                : m.auth_join_finished_opening()
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
            joinError = m.auth_join_failed()
            try {
                game = await api.getPublicGamePreview(game.id)
            } catch {
                joinError = m.auth_join_unreachable()
            }
        } finally {
            joining = false
        }
    }
</script>

<svelte:head>
    <title
        >{game
            ? m.auth_join_page_title({ name: game.name })
            : m.auth_join_invitation_page_title()}</title
    >
</svelte:head>

<main class="mx-auto flex max-w-lg flex-col items-center gap-4 px-4 py-10">
    <Card size="md" class={`w-full p-4 sm:p-6 gap-4 ${gameCardAppearance}`}>
        {#if game}
            <p class="text-sm font-medium text-blue-700 dark:text-blue-300">
                {m.auth_join_invitation()}
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
                {m.auth_join_seat_summary({ players: game.players.length, openSeats })}
            </p>
            {#if options.length}
                <h2 class="text-xs font-semibold uppercase text-gray-600 dark:text-gray-400">
                    {m.auth_join_game_options()}
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
                {m.auth_join_players()}
            </h2>
            <ul class="-mt-3 divide-y divide-gray-200 dark:divide-gray-700">
                {#each players as seat (seat.id)}
                    <li
                        class="flex justify-between gap-4 py-2 text-sm text-gray-600 dark:text-gray-400"
                    >
                        <span
                            >{seat.status === PlayerStatus.Open
                                ? m.auth_join_open_seat()
                                : seat.name}</span
                        >
                        <span class="text-sm text-gray-500 dark:text-gray-400"
                            >{playerStatusDisplay(seat, game.ownerId)}</span
                        >
                    </li>
                {/each}
            </ul>
            {#if joined}
                <Alert color="green">{m.auth_join_joined()}</Alert>
                <Button
                    href={game.status === GameStatus.Started ? gamePlayPath(game.id) : '/dashboard'}
                    >{m.auth_join_go_to_game()}</Button
                >
            {:else if !canJoin}
                <Alert color="blue"
                    >{game.status === GameStatus.Started
                        ? m.auth_join_already_started()
                        : game.status === GameStatus.Finished
                          ? m.auth_join_finished()
                          : m.auth_join_no_open_seats()}</Alert
                >
            {/if}
            {#if joinError}<Alert color="red" role="alert">{joinError}</Alert>{/if}
        {:else}
            <h1 class="text-2xl font-semibold text-gray-900 dark:text-white">
                {data.loadFailed
                    ? m.auth_join_load_failed_heading()
                    : m.auth_join_unavailable_heading()}
            </h1>
            <p class="text-gray-600 dark:text-gray-300">
                {data.loadFailed
                    ? m.auth_join_load_failed_detail()
                    : m.auth_join_unavailable_detail()}
            </p>
        {/if}
        <div class="flex justify-end gap-3 border-t border-gray-200 pt-4 dark:border-gray-700">
            <Button
                size="sm"
                color="light"
                href={user?.status === UserStatus.Active ? '/activeGamesCheck' : '/#games'}
                onclick={clearLoginContinuation}
                disabled={joining}>{game ? m.auth_join_no_thanks() : m.auth_ok()}</Button
            >
            {#if canJoin}
                <Button size="sm" color="green" disabled={joining} onclick={join}
                    >{joining ? m.auth_join_joining() : m.auth_join()}</Button
                >
            {/if}
        </div>
    </Card>
</main>
