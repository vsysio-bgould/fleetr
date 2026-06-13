ALTER TABLE `Playback`
    ADD COLUMN `cruiseQueueEntryId` VARCHAR(191) NULL,
    ADD COLUMN `cruiseOffsetSeconds` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `battleQueueEntryId` VARCHAR(191) NULL,
    ADD COLUMN `battleOffsetSeconds` INTEGER NOT NULL DEFAULT 0;
