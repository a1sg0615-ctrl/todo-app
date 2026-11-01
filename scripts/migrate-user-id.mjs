// 로그인 도입 전 데이터에 userId를 채우는 마이그레이션.
//
// 사용법:
//   npm run migrate:user-id                          # 소유자 없는 문서 수만 보고 (변경 없음, 인덱스만 교체)
//   npm run migrate:user-id -- --assign-to <깃허브아이디>  # 그 사용자에게 할당 (먼저 한 번 로그인해야 함)
//
// 하는 일:
//   1. weeklyplans의 startDate 단독 unique 인덱스(startDate_1)를 지우고 (userId, startDate) unique로 바꾼다.
//      그대로 두면 서로 다른 사용자가 같은 주에 주간 계획을 만들 수 없다.
//   2. userId가 없는 tasks / weeklyplans / yearlygoals를 지정한 사용자에게 할당한다.
// 여러 번 실행해도 안전하다.
import { pathToFileURL } from "node:url";
import mongoose from "mongoose";

const COLLECTIONS = ["tasks", "weeklyplans", "yearlygoals"];
const OWNERLESS = { $or: [{ userId: { $exists: false } }, { userId: null }] };

/** @param {import("mongodb").Db} db */
export async function migrateUserId(db, { assignTo } = {}) {
  const report = { droppedIndex: false, assigned: {}, ownerless: {} };

  const weekly = db.collection("weeklyplans");
  const indexes = await weekly.indexes().catch(() => []); // 컬렉션이 아직 없으면 빈 목록
  if (indexes.some((i) => i.name === "startDate_1")) {
    await weekly.dropIndex("startDate_1");
    report.droppedIndex = true;
  }
  await weekly.createIndex({ userId: 1, startDate: 1 }, { unique: true });

  let user = null;
  if (assignTo) {
    user = await db.collection("users").findOne({ username: assignTo });
    if (!user) throw new Error(`사용자 '${assignTo}'를 찾을 수 없습니다. 먼저 앱에서 GitHub로 한 번 로그인하세요.`);
  }

  for (const name of COLLECTIONS) {
    const collection = db.collection(name);
    if (user) {
      report.assigned[name] = (await collection.updateMany(OWNERLESS, { $set: { userId: user._id } })).modifiedCount;
    }
    report.ownerless[name] = await collection.countDocuments(OWNERLESS);
  }
  return report;
}

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI가 없습니다. .env를 확인하세요.");
  const flag = process.argv.indexOf("--assign-to");
  const assignTo = flag >= 0 ? process.argv[flag + 1] : undefined;

  await mongoose.connect(uri);
  try {
    const report = await migrateUserId(mongoose.connection.db, { assignTo });
    console.log(`startDate_1 인덱스 제거: ${report.droppedIndex ? "제거함" : "이미 없음"}`);
    if (assignTo) console.log(`'${assignTo}'에게 할당:`, report.assigned);
    console.log("남은 소유자 없는 문서:", report.ownerless);
    if (!assignTo && Object.values(report.ownerless).some((n) => n > 0)) {
      console.log("→ 로그인한 뒤 `npm run migrate:user-id -- --assign-to <깃허브아이디>`로 할당하세요.");
    }
  } finally {
    await mongoose.disconnect();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err.message ?? err);
    process.exit(1);
  });
}
