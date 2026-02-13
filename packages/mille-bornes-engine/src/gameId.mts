import { type Brand } from "@repo/depot/brand";
import { Uuid } from "@repo/depot/uuid";

export type GameId = Brand<Uuid, "GameIdStr">;
