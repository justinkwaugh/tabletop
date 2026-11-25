<script lang="ts">
    import { LinkOutline } from 'flowbite-svelte-icons'
    import type { Game } from '@tabletop/common'
    import { copyTextToClipboard } from '@tabletop/frontend-components'
    import { toast } from 'svelte-sonner'
    import { gameShareLink, type GameShareLink } from '$lib/utils/gameLinks'
    import { m } from '$lib/paraglide/messages'

    let { game, namesGame = false }: { game: Game; namesGame?: boolean } = $props()
    const shareLink = $derived(gameShareLink(game))

    async function copyLink(event: Event, link: GameShareLink) {
        event.stopPropagation()
        try {
            await copyTextToClipboard(new URL(link.path, window.location.origin).href)
            toast.success(
                link.kind === 'invite' ? m.games_invite_link_copied() : m.games_game_link_copied()
            )
        } catch {
            toast.error(m.games_copy_link_failed())
        }
    }

    function copyLabel(link: GameShareLink): string {
        return link.kind === 'invite' ? m.games_copy_invite_link() : m.games_copy_game_link()
    }

    function namedCopyLabel(link: GameShareLink): string {
        return link.kind === 'invite'
            ? m.games_copy_invite_link_for({ name: game.name })
            : m.games_copy_game_link_for({ name: game.name })
    }
</script>

{#if shareLink}
    {@const link = shareLink}
    <button
        type="button"
        aria-label={namesGame ? namedCopyLabel(link) : copyLabel(link)}
        title={copyLabel(link)}
        class="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-gray-400 hover:bg-gray-700 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
        onclick={(event) => copyLink(event, link)}
    >
        <LinkOutline class="h-4 w-4" aria-hidden="true" />
    </button>
{/if}
