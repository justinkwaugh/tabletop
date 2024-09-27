<script lang="ts">
    import type { GameUiDefinition } from '@tabletop/frontend-components'
    import { Card } from 'flowbite-svelte'

    let { title }: { title: GameUiDefinition } = $props()
</script>

<Card
    class="overflow-hidden flex-row p-0 pe-0 sm:p-0 sm:pe-2 mb-4 sm:min-w-[650px] max-w-[90vw] sm:max-w-[840px] max-sm:w-[90vw] sm:w-full"
>
    <div class="flex gap-x-4 text-gray-200 max-sm:flex-wrap max-sm:min-w-[90vw]">
        <div class="max-sm:w-full shrink-0 max-sm:max-w-[90vw]">
            <img
                src={title.thumbnailUrl}
                alt={title.metadata.name}
                class="w-full h-auto sm:w-[320px]"
            />
        </div>

        <div
            class="flex flex-col items-start justify-between p-2 shrink min-w-[290px] max-w-[500px]"
        >
            <div class="flex flex-col items-start">
                <div class="text-3xl text-pretty leading-none mt-2">{title.metadata.name}</div>
                <div class="text-md text-gray-400">{title.metadata.year}</div>
            </div>

            <div class="flex flex-col items-start">
                <div class="text-xs text-gray-500 mt-4">DESCRIPTION</div>
                <div class="text-md leading-[1.15] text-pretty">
                    It's time for the next market day! As a rising trader, you are trying to get the
                    best spaces for your market stalls. Only the trader with the freshest goods will
                    get the most customers. In Fresh Fish you try to build your market stalls as
                    close as possible to the matching delivery trucks on a huge market square. A
                    delivery of goods directly from the delivery truck into the market stall is not
                    allowed; at least one path space must lie between them. Unfortunately the
                    competition between the traders is quite intense, so you will block each other
                    from the shortest paths with your market stalls.
                </div>
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
