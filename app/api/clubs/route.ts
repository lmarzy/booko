import { desc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { clubs, clubMembers, users } from "../../../db/schema";
import { getChatGPTUser } from "../../chatgpt-auth";

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error:"Sign in required" }, { status:401 });
  const db = getDb();
  const rows = await db.select().from(clubs).where(eq(clubs.hostUserId,user.userId)).orderBy(desc(clubs.createdAt));
  return Response.json({ clubs:rows });
}

export async function POST(request:Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error:"Sign in required" }, { status:401 });
  const data = await request.json() as Record<string,string>;
  const name = data.name?.trim(); const bookTitle = data.bookTitle?.trim(); const author = data.author?.trim(); const meetingDate = data.meetingDate?.trim(); const readingPace = data.readingPace?.trim();
  if (!name || !bookTitle || !author || !meetingDate || !readingPace) return Response.json({error:"Please complete every required field."},{status:400});
  if (name.length>80 || bookTitle.length>160 || author.length>120) return Response.json({error:"One or more fields are too long."},{status:400});
  const memberEmails = (data.members||"").split(",").map((item)=>item.trim().toLowerCase()).filter(Boolean);
  if (memberEmails.some((email)=>!/^\S+@\S+\.\S+$/.test(email))) return Response.json({error:"Please check the invited email addresses."},{status:400});
  const db = getDb();
  await db.insert(users).values({id:user.userId,email:user.email,displayName:user.displayName}).onConflictDoUpdate({target:users.id,set:{email:user.email,displayName:user.displayName}});
  const [club] = await db.insert(clubs).values({name,bookTitle,author,meetingDate,readingPace,hostUserId:user.userId}).returning();
  for (const email of [...new Set(memberEmails)]) await db.insert(clubMembers).values({clubId:club.id,email,status:"invited"});
  return Response.json({club:{...club,members:[...new Set(memberEmails)]}},{status:201});
}
