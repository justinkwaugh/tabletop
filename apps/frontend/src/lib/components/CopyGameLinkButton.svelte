<script lang="ts">
    import { LinkOutline } from 'flowbite-svelte-icons'
    import type { Game } from '@tabletop/common'
    import { copyTextToClipboard } from '@tabletop/frontend-components'
    import { toast } from 'svelte-sonner'
    import { gameShareLink, type GameShareLink } from '$lib/utils/gameLinks'

    let { game, namesGame = false }: { game: Game; namesGame?: boolean } = $props()
    const shareLink = $derived(gameShareLink(game))

    async function copyLink(event: Event, link: GameShareLink) {
        event.stopPropagation()
        try {
            await copyTextToClipboard(new URL(link.path, window.location.origin).href)
            toast.success(link.kind === 'invite' ? 'Invite link copied' : 'Game link copied')
        } catch {
            toast.error('Unable to copy the link. Please try again.')
        }
    }
</script>

{#if shareLink}
    {@const link = shareLink}
    <button
        type="button"
        aria-label={namesGame
            ? `Copy ${link.kind} link for ${game.name}`
            : `Copy ${link.kind} link`}
        title={`Copy ${link.kind} link`}
        class="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-gray-400 hover:bg-gray-700 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
        onclick={(event) => copyLink(event, link)}
    >
        <LinkOutline class="h-4 w-4" aria-hidden="true" />
    </button>
{/if}
