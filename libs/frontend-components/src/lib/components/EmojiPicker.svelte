<script lang="ts">
    import { EmojiButton } from '@joeattardi/emoji-button'
    import { FaceGrinSolid } from 'flowbite-svelte-icons'
    import { onMount } from 'svelte'

    let { onPick, onHidden }: { onPick: (event: any) => void; onHidden: () => void } = $props()

    const picker = new EmojiButton({
        theme: 'auto',
        initialCategory: 'recents',
        showPreview: false,
        showCategoryButtons: false,
        emojisPerRow: 6,

        emojiSize: '1.6em'
    })

    let triggerButton: HTMLElement

    picker.on('emoji', (selection) => {
        onPick(selection)
    })

    picker.on('hidden', () => {
        onHidden()
    })

    function togglePicker() {
        picker.togglePicker(triggerButton)
    }

    onMount(() => {
        return () => {
            picker.destroyPicker()
        }
    })
</script>

<button bind:this={triggerButton} onclick={togglePicker}> <FaceGrinSolid /> </button>
