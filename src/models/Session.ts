import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

// 쿠키에는 원본 토큰, DB에는 sha256 해시만 저장한다. DB가 유출돼도 세션을 가로챌 수 없다.
const sessionSchema = new Schema({
  tokenHash: { type: String, required: true, unique: true },
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  // TTL 인덱스: 만료 시각이 지나면 MongoDB가 문서를 지운다.
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
});

export const Session: Model<InferSchemaType<typeof sessionSchema>> =
  models.Session ?? model("Session", sessionSchema);
