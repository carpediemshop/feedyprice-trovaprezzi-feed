-- CreateTable
CREATE TABLE "FeedState" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "feedStatus" TEXT NOT NULL,
    "feedUrl" TEXT NOT NULL,
    "includedCount" INTEGER NOT NULL DEFAULT 0,
    "excludedCount" INTEGER NOT NULL DEFAULT 0,
    "xmlContent" TEXT NOT NULL,
    "lastGeneratedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "FeedState_shop_key" ON "FeedState"("shop");
