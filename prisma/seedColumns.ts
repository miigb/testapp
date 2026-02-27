import { PrismaClient } from '@prisma/client'
import { ALL_DEFAULT_COLUMNS } from '../src/constants/columnDefinitions'

const prisma = new PrismaClient()

async function seedColumns() {
  const admin = await prisma.user.findFirst({
    where: { role: 'ADMIN' },
  }) ?? await prisma.user.findFirst()

  if (!admin) {
    console.error('No users found. Create at least one user before seeding columns.')
    process.exit(1)
  }

  let created = 0
  let skipped = 0

  for (const [module, views] of Object.entries(ALL_DEFAULT_COLUMNS)) {
    for (const [view, columns] of Object.entries(views)) {
      for (const col of columns) {
        const existing = await prisma.columnConfig.findUnique({
          where: { module_view_key: { module, view, key: col.key } },
        })
        if (existing) {
          skipped++
          continue
        }
        await prisma.columnConfig.create({
          data: {
            module,
            view,
            key: col.key,
            label: col.label,
            type: col.type,
            visible: true,
            position: col.position,
            isCustom: false,
            isReference: false,
            createdById: admin.id,
          },
        })
        created++
      }
    }
  }

  console.log(`Column seed complete: ${created} created, ${skipped} skipped (already exist)`)
}

seedColumns()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
