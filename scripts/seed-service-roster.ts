import { prisma } from '../src/lib/db'
import { initializeServiceRoster } from '../src/lib/service-roster-store'
void initializeServiceRoster(prisma).then(() => console.log('Service roster initial import ready')).catch(() => {
  console.warn('Service roster initial import unavailable; administrator can retry from service roster page')
}).finally(() => prisma.$disconnect())
