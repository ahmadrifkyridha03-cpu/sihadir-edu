import { PrismaClient } from '@prisma/client'

/**
 * Creates a configured PrismaClient instance.
 * Enables query logging in development mode for easy debugging.
 */
const prismaClientSingleton = () => {
  return new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? ['query', 'error', 'warn']
        : ['error'],
  })
}

// Extend NodeJS global type definition for hot-reload persistence
declare const globalThis: {
  prismaGlobal: ReturnType<typeof prismaClientSingleton> | undefined
} & typeof global

export const db = globalThis.prismaGlobal ?? prismaClientSingleton()

// Assign to globalThis in non-production environments to reuse the instance
if (process.env.NODE_ENV !== 'production') {
  globalThis.prismaGlobal = db
}

// Aliases and default export for maximum consumer flexibility
export const prisma = db
export default db
