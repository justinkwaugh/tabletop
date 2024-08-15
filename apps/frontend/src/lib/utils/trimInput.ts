export function trim(event: Event) {
    const input = event.target as HTMLInputElement
    input.value = input.value.trim()
}
