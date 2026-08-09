import { desc, eq } from "drizzle-orm";
import { getDb } from "../../db";
import { clubs, clubMembers } from "../../db/schema";
import { chatGPTSignOutPath, requireChatGPTUser } from "../chatgpt-auth";
import ClubDashboard, { ClubView } from "./ClubDashboard";

export const dynamic = "force-dynamic";

export default async function ClubsPage() {
  const user = await requireChatGPTUser("/clubs");
  const db = getDb();
  const owned = await db.select().from(clubs).where(eq(clubs.hostUserId, user.userId)).orderBy(desc(clubs.createdAt));
  const views: ClubView[] = [];
  for (const club of owned) {
    const members = await db.select().from(clubMembers).where(eq(clubMembers.clubId, club.id));
    views.push({ ...club, members: members.map((member) => member.email) });
  }

  return <ClubDashboard initialClubs={views} user={{ displayName: user.displayName, email: user.email }} signOutHref={chatGPTSignOutPath("/")} />;
}
