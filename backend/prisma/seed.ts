import { faker } from "@faker-js/faker";
import bcrypt from "bcrypt";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const BCRYPT_COST = 12;

const PRODUCT_COUNT = Number(process.env.SEED_PRODUCT_COUNT ?? 3000);
const SPONSORED_COUNT = 20;
const BATCH_SIZE = 500;

const CATEGORIES = [
  "Electronics",
  "Home & Kitchen",
  "Sports & Outdoors",
  "Books",
  "Toys & Games",
  "Beauty & Personal Care",
  "Clothing",
  "Shoes",
  "Grocery",
  "Office Supplies",
  "Pet Supplies",
  "Automotive",
  "Garden & Outdoor",
  "Health & Household",
  "Jewelry",
];

interface SeedProduct {
  name: string;
  description: string;
  category: string;
  priceCents: number;
  isSponsored: boolean;
}

function randomProduct(isSponsored: boolean): SeedProduct {
  const category = faker.helpers.arrayElement(CATEGORIES);
  const name = `${faker.commerce.productAdjective()} ${faker.commerce.product()}`;
  const description = faker.commerce.productDescription();
  const priceCents = faker.number.int({ min: 499, max: 49999 });
  return { name, description, category, priceCents, isSponsored };
}

async function seedUsers() {
  const demoUsers = [
    {
      email: process.env.SEED_DEMO_USER_EMAIL ?? "demo@example.com",
      password: process.env.SEED_DEMO_USER_PASSWORD ?? "ChangeMe123!",
    },
    {
      // Second account exists so login error states (wrong password vs. no
      // such account) are both demoable without either response leaking
      // which case applies.
      email: "demo2@example.com",
      password: "ChangeMe123!",
    },
  ];

  for (const { email, password } of demoUsers) {
    const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
    await prisma.user.upsert({
      where: { email },
      update: { passwordHash },
      create: { email, passwordHash },
    });
  }

  console.log(`Seeded ${demoUsers.length} demo user(s).`);
}

async function seedProducts() {
  // Fake catalog data is fully regenerable, so a clean wipe-and-reload each
  // run keeps this idempotent without needing per-row upsert logic.
  await prisma.product.deleteMany();

  faker.seed(42); // reproducible dataset across runs/machines

  const organic: SeedProduct[] = Array.from({ length: PRODUCT_COUNT }, () =>
    randomProduct(false),
  );
  const sponsored: SeedProduct[] = Array.from({ length: SPONSORED_COUNT }, () =>
    randomProduct(true),
  );
  const all = [...organic, ...sponsored];

  for (let i = 0; i < all.length; i += BATCH_SIZE) {
    const batch = all.slice(i, i + BATCH_SIZE);
    await prisma.product.createMany({ data: batch });
  }

  console.log(
    `Seeded ${organic.length} organic products + ${sponsored.length} sponsored products across ${CATEGORIES.length} categories.`,
  );
}

async function main() {
  await seedUsers();
  await seedProducts();
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
