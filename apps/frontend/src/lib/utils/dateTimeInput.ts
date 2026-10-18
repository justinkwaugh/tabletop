export function localDateTimeInputValue(time: number): string {
    const date = new Date(time)
    return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
}
