export const suppliedFiles: Record<string, string> = import.meta.glob<string>(
    './supplied/*.{webp,png}',
    { eager: true, import: 'default' }
)
