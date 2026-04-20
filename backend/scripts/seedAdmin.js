import "dotenv/config";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { User } from "../src/models/User.js";

const SALT_ROUNDS = 10;

const SUPER_ADMIN_EMAIL = String(
  process.env.SUPER_ADMIN_EMAIL || "mp890520@gmail.com",
)
  .trim()
  .toLowerCase();

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("Set MONGODB_URI in .env");
    process.exit(1);
  }

  const email = String(
    process.env.SEED_ADMIN_EMAIL || SUPER_ADMIN_EMAIL,
  ).trim().toLowerCase();
  const password = String(
    process.env.SEED_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD || "",
  );

  if (email !== SUPER_ADMIN_EMAIL) {
    console.error(
      `Seed only creates the system admin (${SUPER_ADMIN_EMAIL}). Set SEED_ADMIN_EMAIL to that address or unset it.`,
    );
    process.exit(1);
  }

  if (!password) {
    console.error("Set SEED_ADMIN_PASSWORD in .env");
    process.exit(1);
  }

  await mongoose.connect(uri);

  const existing = await User.findOne({ email: SUPER_ADMIN_EMAIL });
  if (existing) {
    console.log("Super admin already exists:", SUPER_ADMIN_EMAIL);
    await mongoose.disconnect();
    return;
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  await User.create({
    email: SUPER_ADMIN_EMAIL,
    passwordHash,
    name: "Admin",
    role: "admin",
    activeStatus: true,
  });

  console.log("Created super admin:", SUPER_ADMIN_EMAIL);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
