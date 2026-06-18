import { createUser, findUserByUsername, runMigrations, type UserRole } from "./db";
import { hashPassword } from "./auth";

const seededUsers: Array<{
  username: string;
  password: string;
  role: UserRole;
}> = [
  {
    username: "admin",
    password: "Admin@123",
    role: "ADMIN",
  },
  {
    username: "reception.off",
    password: "Reception@123",
    role: "OFFICIAL",
  },
];

runMigrations();

for (const user of seededUsers) {
  const existingUser = findUserByUsername(user.username);

  if (existingUser) {
    console.log(`Seed skipped: ${user.username} already exists.`);
    continue;
  }

  const passwordHash = await hashPassword(user.password);
  createUser({
    username: user.username,
    role: user.role,
    passwordHash,
  });
  console.log(`Seeded ${user.role}: ${user.username}`);
}
