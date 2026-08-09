import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id:text("id").primaryKey(), email:text("email").notNull(), displayName:text("display_name").notNull(), createdAt:text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table)=>[uniqueIndex("idx_users_email").on(table.email)]);

export const clubs = sqliteTable("clubs", {
  id:integer("id").primaryKey({autoIncrement:true}), hostUserId:text("host_user_id").notNull().references(()=>users.id,{onDelete:"cascade"}), name:text("name").notNull(), bookTitle:text("book_title").notNull(), author:text("author").notNull(), meetingDate:text("meeting_date").notNull(), readingPace:text("reading_pace").notNull(), createdAt:text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table)=>[index("idx_clubs_host_created").on(table.hostUserId,table.createdAt)]);

export const clubMembers = sqliteTable("club_members", {
  id:integer("id").primaryKey({autoIncrement:true}), clubId:integer("club_id").notNull().references(()=>clubs.id,{onDelete:"cascade"}), email:text("email").notNull(), status:text("status").notNull().default("invited"), createdAt:text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table)=>[uniqueIndex("idx_club_members_club_email").on(table.clubId,table.email)]);
