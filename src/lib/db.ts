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

// Extend NodeJS global type definition for hot-reload persistence and mock isolation
declare const globalThis: {
  prismaGlobal: any | undefined
} & typeof global

export const db: PrismaClient = new Proxy({} as any, {
  get(_target, prop) {
    const activeDb = globalThis.prismaGlobal ?? (globalThis.prismaGlobal = prismaClientSingleton())
    const val = activeDb[prop]
    if (typeof val === 'function') {
      return val.bind(activeDb)
    }
    return val
  },
})

// Aliases and default export for maximum consumer flexibility
export const prisma = db
export default db
