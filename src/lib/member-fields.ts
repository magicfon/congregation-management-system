// Explicit public fields: never serialize password hashes.
export const memberFields = {
  id: true, name: true, email: true, phone: true, role: true,
  active: true, createdAt: true, updatedAt: true,
} as const

export const memberLineFields = {
  ...memberFields, gender: true, showInDispatch: true, selfManagedReports: true, lineuid: true, lineDisplayName: true,
} as const
