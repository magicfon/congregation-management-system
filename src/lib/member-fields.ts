// Explicit public fields: never serialize password hashes.
export const memberFields = {
  id: true, name: true, email: true, phone: true, role: true,
  active: true, createdAt: true, updatedAt: true,
} as const

export const memberLineFields = {
  ...memberFields, lineuid: true, lineDisplayName: true,
} as const
