// 로컬에 MongoDB를 설치하지 않고 개발용 MongoDB를 띄운다.
// 사용법: npm run db:dev            (데이터를 .data/db에 보관, 포트 27017)
//         node scripts/dev-db.mjs --port 27018 --ephemeral   (종료 시 데이터 삭제)
import { mkdirSync } from "node:fs";
import { MongoMemoryServer } from "mongodb-memory-server";

const args = process.argv.slice(2);
const portArg = args.indexOf("--port");
const port = portArg >= 0 ? Number(args[portArg + 1]) : 27017;
const ephemeral = args.includes("--ephemeral");

const dbPath = ephemeral ? undefined : ".data/db";
if (dbPath) mkdirSync(dbPath, { recursive: true });

const server = await MongoMemoryServer.create({
  instance: { port, dbPath, storageEngine: "wiredTiger" },
});
console.log(`MongoDB ready: ${server.getUri()}${ephemeral ? " (ephemeral)" : ` (data: ${dbPath})`}`);

const stop = async () => {
  await server.stop({ doCleanup: ephemeral });
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
