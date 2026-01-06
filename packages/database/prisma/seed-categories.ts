import { PrismaClient } from "../generated/prisma";

const prisma = new PrismaClient();

const categories = [
  {
    name: "Landing Pages",
    slug: "landing-pages",
    description:
      "Beautiful landing pages for products, services, and portfolios",
    icon: "🏠",
    order: 1,
  },
  {
    name: "E-commerce",
    slug: "ecommerce",
    description: "Online stores, shopping carts, and product catalogs",
    icon: "🛒",
    order: 2,
  },
  {
    name: "Dashboards",
    slug: "dashboards",
    description: "Admin panels, analytics dashboards, and data visualization",
    icon: "📊",
    order: 3,
  },
  {
    name: "Apps",
    slug: "apps",
    description: "Full-featured web applications and tools",
    icon: "📱",
    order: 4,
  },
  {
    name: "Forms & Tools",
    slug: "forms-tools",
    description: "Forms, surveys, calculators, and utilities",
    icon: "📝",
    order: 5,
  },
  {
    name: "Creative",
    slug: "creative",
    description: "Portfolios, galleries, and creative showcases",
    icon: "🎨",
    order: 6,
  },
];

async function main() {
  console.log("🌱 Seeding template categories...");

  for (const category of categories) {
    const created = await prisma.templateCategory.upsert({
      where: { slug: category.slug },
      update: category,
      create: category,
    });
    console.log(`✅ Created category: ${created.name}`);
  }

  console.log("🎉 Seeding complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
