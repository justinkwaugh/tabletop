/** Files in the asset folder, by path. An empty folder gives an empty record. */
export const suppliedFiles: Record<string, string> = import.meta.glob<string>(
    './supplied/*.{webp,png}',
    { eager: true, import: 'default' }
)
