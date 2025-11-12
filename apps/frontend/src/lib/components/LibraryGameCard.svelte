<script lang="ts">
    import type { GameState, HydratedGameState } from '@tabletop/common'
    import type { GameUiDefinition } from '@tabletop/frontend-components'
    import { Card } from 'flowbite-svelte'

    let {
        title,
        onclick
    }: { title: GameUiDefinition<GameState, HydratedGameState>; onclick?: (event: Event) => void } =
        $props()
</script>

<Card
    onclick={(event: Event) => onclick?.(event)}
    class="cursor-pointer  p-0 pe-2 sm:p-0 sm:pe-2 overflow-hidden"
>
    <div class="flex gap-x-4 text-gray-200">
        <img src={title.thumbnailUrl} alt={title.metadata.name} class="h-[150px]" />
        <div class="flex flex-col items-start justify-between w-full">
            <div class="flex flex-col items-start">
                <div class="text-2xl text-pretty leading-none mt-2">{title.metadata.name}</div>
                <div class="text-md text-gray-400">{title.metadata.year}</div>
            </div>

            <div class="flex flex-row justify-between items-end w-full">
                <div class="flex flex-col items-start mb-2">
                    <div class="text-xs text-gray-500 mt-4">DESIGNED BY</div>
                    <div class="text-md leading-[1.15] text-pretty">
                        {title.metadata.designer}
                    </div>
                </div>
                <div class="flex flex-col items-end mb-2">
                    <div class="text-xs text-gray-500 mt-4">PLAYERS</div>
                    <div class="text-md leading-[1.15]">
                        {title.metadata.minPlayers} - {title.metadata.maxPlayers}
                    </div>
                </div>
            </div>
        </div>
    </div>
</Card>
