-- SQLite's ordinary UNIQUE index compares text case-sensitively.
CREATE UNIQUE INDEX "User_email_nocase_key" ON "User"("email" COLLATE NOCASE);
