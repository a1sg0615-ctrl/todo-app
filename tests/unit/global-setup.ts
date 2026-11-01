import { MongoMemoryServer } from "mongodb-memory-server";

// 테스트 파일마다 mongod를 띄우면 Windows에서 기동 시간 초과가 나서, 한 번만 띄워 공유한다.
export default async function setup() {
  const server = await MongoMemoryServer.create({ instance: { launchTimeout: 60_000 } });
  process.env.MONGODB_URI = server.getUri("todo-test");
  return () => server.stop();
}
