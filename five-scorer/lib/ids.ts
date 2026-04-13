import { createId } from "@paralleldrive/cuid2";

// Client-side ID generator. Same shape as Prisma's default cuid() on the
// server, so IDs generated offline on the phone can be persisted as-is.
export function newId(): string {
  return createId();
}
