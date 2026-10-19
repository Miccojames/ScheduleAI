import "dotenv/config";
import { defineConfig } from "prisma/config";

// Prisma 7 reads the datasource URL from this config file (the schema no longer
// declares `url = env(...)`).
export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: process.env.DATABASE_URL!,
  },
});
