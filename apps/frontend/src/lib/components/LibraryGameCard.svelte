<script lang="ts">
    import type { GameState, HydratedGameState } from '@tabletop/common'
    import type { GameUiDefinition } from '@tabletop/frontend-components'
    import { Card } from 'flowbite-svelte'

    let {
        title,
        onclick
    }: { title: GameUiDefinition<GameState, HydratedGameState>; onclick?: (event: Event) => void } =
        $props()

    const designerSizeClass = $derived.by(() => {
        const length = title.info.metadata.designer?.length ?? 0
        if (length > 35) {
            return 'text-xs'
        }
        return 'text-sm'
    })
</script>

<Card
    onclick={(event: Event) => onclick?.(event)}
    class="cursor-pointer p-0 pe-2 sm:p-0 sm:pe-2 overflow-hidden min-w-[320px] max-w-[340px]"
>
    <div class="flex gap-x-4 text-gray-200 text-start">
        <img src={title.info.thumbnailUrl} alt={title.info.metadata.name} class="h-[150px]" />
        <div class="flex flex-col items-start justify-between w-full">
            <div class="flex flex-col items-start">
                <div class="text-2xl text-pretty leading-none mt-2">
                    {title.info.metadata.name}
                </div>
                <div class="text-md text-gray-400">{title.info.metadata.year}</div>
            </div>

            <div class="flex flex-row justify-between items-end w-full">
                <div class="flex flex-col items-start mb-2">
                    <div class="text-xs text-gray-500 mt-2">DESIGNED BY</div>
                    <div class={`leading-[1.15] text-pretty ${designerSizeClass}`}>
                        {title.info.metadata.designer}
                    </div>
                </div>
                <div class="flex flex-col items-end mb-2">
                    <div class="text-xs text-gray-500 mt-2">PLAYERS</div>
                    <div class="text-sm leading-[1.15]">
                        {title.info.metadata.minPlayers} - {title.info.metadata.maxPlayers}
                    </div>
                </div>
            </div>
        </div>
    </div>
</Card>
