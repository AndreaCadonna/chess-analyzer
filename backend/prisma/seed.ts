import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Create a test user
  const testUser = await prisma.user.create({
    data: {
      chessComUsername: "hikaru",
      email: "test@example.com",
    },
  });

  console.log("✅ Database seeded with test user:", testUser);
}

main()
  .catch((e) => {
    console.error("❌ Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
