import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
console.log(Object.keys(prisma).filter((key) => !key.startsWith('_')).sort().join('\n'))
await prisma.$disconnect()
