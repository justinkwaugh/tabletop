<script lang="ts">
    import { Card } from 'flowbite-svelte'
    import GameCard from '$lib/components/GameCard.svelte'
    import type { Game } from '@tabletop/common'
    import { goto } from '$app/navigation'

    let { data }: { data: { game: Game } } = $props()

    let invitationGame: Game | undefined = $derived(data.game)

    function gotoDashboard() {
        invitationGame = undefined
        goto('/dashboard')
    }
</script>

<div class="h-[calc(100dvh-70px)] flex flex-col items-center justify-center">
    <Card>
        <h1 class="text-2xl font-medium text-gray-900 dark:text-gray-300 mb-4">
            Join this game?...
        </h1>
        <div class="flex flex-col items-center">
            {#if invitationGame}
                <GameCard
                    game={invitationGame}
                    expanded={'always'}
                    ondecline={gotoDashboard}
                    onjoin={gotoDashboard}
                />
            {/if}
        </div>
    </Card>
</div>
