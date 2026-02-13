<script lang="ts">
    import { type Snippet } from 'svelte'
    import { Floater } from '@tabletop/frontend-components'

    let {
        placement = 'top',
        trigger = 'auto',
        offset = 20,
        onClose = () => {},
        children
    }: {
        placement?: 'top' | 'bottom' | 'left' | 'right'
        trigger?: 'auto' | 'manual'
        offset?: number
        onClose?: () => void
        children?: Snippet
    } = $props()

    let floater: Floater

    export function toggle() {
        floater.toggle()
    }

    export function close() {
        floater.close()
    }
</script>

<Floater bind:this={floater} {placement} reference="#board-picker-ref" {onClose} {trigger} {offset}>
    <div
        class="flex flex-col justify-center items-center space-y-2 rounded-lg dark:bg-black/90 p-2 border-1 border-[#ad9c80] sol-font text-xs text-[#ad9c80] tracking-widest"
    >
        {#if children}
            {@render children()}
        {/if}
    </div>
</Floater>
