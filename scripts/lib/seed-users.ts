/**
 * Ba user của môi trường dev. Dùng chung cho `pnpm db:seed` và `pnpm test:rls`.
 *
 * CHỈ dành cho database dev. Không bao giờ tạo những user này trên production.
 */
export interface SeedUser {
  email: string;
  password: string;
  fullName: string;
  /** Mã cửa hàng được gán, kèm vai trò. Owner có 2 dòng. */
  memberships: { storeCode: "CH1" | "CH2"; role: "owner" | "staff" }[];
}

export const SEED_PASSWORD = "ngocson-dev-2026";

export const SEED_USERS: SeedUser[] = [
  {
    email: "owner@ngocson.local",
    password: SEED_PASSWORD,
    fullName: "Chủ cửa hàng",
    memberships: [
      { storeCode: "CH1", role: "owner" },
      { storeCode: "CH2", role: "owner" },
    ],
  },
  {
    email: "staff1@ngocson.local",
    password: SEED_PASSWORD,
    fullName: "Nhân viên Ngọc Sơn 1",
    memberships: [{ storeCode: "CH1", role: "staff" }],
  },
  {
    email: "staff2@ngocson.local",
    password: SEED_PASSWORD,
    fullName: "Nhân viên Ngọc Sơn 2",
    memberships: [{ storeCode: "CH2", role: "staff" }],
  },
];

export const OWNER = SEED_USERS[0];
export const STAFF_CH1 = SEED_USERS[1];
export const STAFF_CH2 = SEED_USERS[2];
