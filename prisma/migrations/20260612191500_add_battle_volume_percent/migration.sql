ALTER TABLE `Fleet` ADD COLUMN `battleVolumePercent` INTEGER NOT NULL DEFAULT 25;
ALTER TABLE `Fleet` ADD COLUMN `downvoteDeletePercent` INTEGER NOT NULL DEFAULT 50;

CREATE TABLE `QueueDownvote` (
    `id` VARCHAR(191) NOT NULL,
    `queueEntryId` VARCHAR(191) NOT NULL,
    `characterId` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `QueueDownvote_queueEntryId_characterId_key`(`queueEntryId`, `characterId`),
    INDEX `QueueDownvote_queueEntryId_idx`(`queueEntryId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `QueueDownvote` ADD CONSTRAINT `QueueDownvote_queueEntryId_fkey` FOREIGN KEY (`queueEntryId`) REFERENCES `QueueEntry`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `QueueDownvote` ADD CONSTRAINT `QueueDownvote_characterId_fkey` FOREIGN KEY (`characterId`) REFERENCES `User`(`characterId`) ON DELETE RESTRICT ON UPDATE CASCADE;
