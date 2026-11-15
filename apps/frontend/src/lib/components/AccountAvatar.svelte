<script lang="ts">
    import { Color, type User } from '@tabletop/common'

    let { user }: { user: User } = $props()

    const fallbackColors = [
        Color.Red,
        Color.Orange,
        Color.Green,
        Color.Purple,
        Color.Pink,
        Color.Brown
    ]
    const tintForColor: Record<Color, string> = {
        [Color.Red]: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300',
        [Color.Orange]: 'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300',
        [Color.Yellow]: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-400/20 dark:text-yellow-200',
        [Color.Green]: 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300',
        [Color.Blue]: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300',
        [Color.Purple]: 'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300',
        [Color.Pink]: 'bg-pink-100 text-pink-700 dark:bg-pink-500/20 dark:text-pink-300',
        [Color.Brown]: 'bg-amber-100 text-amber-800 dark:bg-amber-700/30 dark:text-amber-200',
        [Color.Gray]: 'bg-gray-200 text-gray-700 dark:bg-gray-500/25 dark:text-gray-200',
        [Color.Black]: 'bg-gray-800 text-white dark:bg-black/50 dark:text-gray-100',
        [Color.White]: 'bg-gray-100 text-gray-900 dark:bg-white/15 dark:text-white'
    }

    function hash(value: string): number {
        let result = 0
        for (const character of value)
            result = (result * 31 + (character.codePointAt(0) ?? 0)) >>> 0
        return result
    }

    let preferences = $derived(user.preferences)
    let color = $derived(
        (preferences?.preferredColorsEnabled && preferences.preferredColors[0]) ||
            fallbackColors[hash(user.id) % fallbackColors.length]
    )
    let initial = $derived(Array.from(user.username ?? '?')[0].toUpperCase())
</script>

<span
    aria-hidden="true"
    class="inline-block size-9 rounded-full pt-[1.5px] text-center text-2xl leading-[34.5px] font-semibold select-none {tintForColor[
        color
    ]}">{initial}</span
>
