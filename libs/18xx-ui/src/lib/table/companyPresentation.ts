export type CompanyNameVariants = { short: string; initials: string; history?: string; card?: string }

export type NumberedShareNames = Readonly<Record<string, Readonly<Record<number, string>>>>
