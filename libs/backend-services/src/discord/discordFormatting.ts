export function truncate(text: string, maxLength: number): string {
    return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text
}

export function escapeMarkdown(text: string): string {
    return text.replace(/[\\*_~`|>#[\]()<:-]/g, '\\$&')
}
