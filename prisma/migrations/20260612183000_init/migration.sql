-- CreateTable
CREATE TABLE `User` (
    `characterId` INTEGER NOT NULL,
    `characterName` VARCHAR(191) NOT NULL,
    `isOperator` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`characterId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ApiToken` (
    `id` VARCHAR(191) NOT NULL,
    `characterId` INTEGER NOT NULL,
    `label` VARCHAR(191) NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `lastUsedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ApiToken_characterId_idx`(`characterId`),
    INDEX `ApiToken_expiresAt_idx`(`expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `UserScopePreference` (
    `characterId` INTEGER NOT NULL,
    `scopes` JSON NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`characterId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EsiToken` (
    `characterId` INTEGER NOT NULL,
    `refreshToken` TEXT NOT NULL,
    `accessToken` TEXT NOT NULL,
    `accessTokenExpiresAt` DATETIME(3) NOT NULL,
    `scopes` JSON NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`characterId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AdvisoryDismissal` (
    `characterId` INTEGER NOT NULL,
    `key` VARCHAR(191) NOT NULL,
    `lastShownAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `permanent` BOOLEAN NOT NULL DEFAULT false,

    INDEX `AdvisoryDismissal_characterId_idx`(`characterId`),
    PRIMARY KEY (`characterId`, `key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Fleet` (
    `id` VARCHAR(191) NOT NULL,
    `esiFleetId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `joinToken` VARCHAR(191) NOT NULL,
    `mode` ENUM('CRUISE', 'BATTLE') NOT NULL DEFAULT 'CRUISE',
    `mediaSource` ENUM('YOUTUBE', 'SOUNDCLOUD', 'CUSTOM') NOT NULL DEFAULT 'YOUTUBE',
    `fcCharacterId` INTEGER NOT NULL,
    `expiresAt` DATETIME(3) NULL,
    `disbandedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Fleet_esiFleetId_key`(`esiFleetId`),
    UNIQUE INDEX `Fleet_joinToken_key`(`joinToken`),
    INDEX `Fleet_fcCharacterId_idx`(`fcCharacterId`),
    INDEX `Fleet_joinToken_idx`(`joinToken`),
    INDEX `Fleet_disbandedAt_expiresAt_idx`(`disbandedAt`, `expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `FleetDelegate` (
    `id` VARCHAR(191) NOT NULL,
    `fleetId` VARCHAR(191) NOT NULL,
    `characterId` INTEGER NOT NULL,
    `grantedBy` INTEGER NOT NULL,
    `grantedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `FleetDelegate_fleetId_idx`(`fleetId`),
    UNIQUE INDEX `FleetDelegate_fleetId_characterId_key`(`fleetId`, `characterId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Session` (
    `id` VARCHAR(191) NOT NULL,
    `fleetId` VARCHAR(191) NOT NULL,
    `characterId` INTEGER NOT NULL,
    `role` ENUM('LINE_MEMBER', 'FLEET_COMMANDER', 'FC_DELEGATE') NOT NULL,
    `grantedScopes` JSON NOT NULL,
    `ipAddress` VARCHAR(191) NULL,
    `solarSystem` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expiresAt` DATETIME(3) NOT NULL,

    INDEX `Session_fleetId_idx`(`fleetId`),
    INDEX `Session_expiresAt_idx`(`expiresAt`),
    UNIQUE INDEX `Session_fleetId_characterId_key`(`fleetId`, `characterId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `QueueEntry` (
    `id` VARCHAR(191) NOT NULL,
    `fleetId` VARCHAR(191) NOT NULL,
    `queue` ENUM('CRUISE', 'BATTLE') NOT NULL,
    `mediaUrl` VARCHAR(191) NOT NULL,
    `mediaId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `thumbnailUrl` VARCHAR(191) NULL,
    `duration` INTEGER NULL,
    `submittedBy` INTEGER NOT NULL,
    `position` DOUBLE NOT NULL DEFAULT 0,
    `submittedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `removedAt` DATETIME(3) NULL,
    `removedBy` INTEGER NULL,

    INDEX `QueueEntry_fleetId_queue_removedAt_position_idx`(`fleetId`, `queue`, `removedAt`, `position`),
    INDEX `QueueEntry_submittedBy_idx`(`submittedBy`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Vote` (
    `id` VARCHAR(191) NOT NULL,
    `queueEntryId` VARCHAR(191) NOT NULL,
    `characterId` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Vote_queueEntryId_idx`(`queueEntryId`),
    UNIQUE INDEX `Vote_queueEntryId_characterId_key`(`queueEntryId`, `characterId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Playback` (
    `fleetId` VARCHAR(191) NOT NULL,
    `queueEntryId` VARCHAR(191) NULL,
    `mediaId` VARCHAR(191) NULL,
    `startedAt` DATETIME(3) NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`fleetId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AuditLog` (
    `id` VARCHAR(191) NOT NULL,
    `event` VARCHAR(191) NOT NULL,
    `actor` VARCHAR(191) NOT NULL,
    `payload` JSON NOT NULL,
    `ip` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AuditLog_event_createdAt_idx`(`event`, `createdAt`),
    INDEX `AuditLog_actor_createdAt_idx`(`actor`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ApiToken` ADD CONSTRAINT `ApiToken_characterId_fkey` FOREIGN KEY (`characterId`) REFERENCES `User`(`characterId`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserScopePreference` ADD CONSTRAINT `UserScopePreference_characterId_fkey` FOREIGN KEY (`characterId`) REFERENCES `User`(`characterId`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EsiToken` ADD CONSTRAINT `EsiToken_characterId_fkey` FOREIGN KEY (`characterId`) REFERENCES `User`(`characterId`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AdvisoryDismissal` ADD CONSTRAINT `AdvisoryDismissal_characterId_fkey` FOREIGN KEY (`characterId`) REFERENCES `User`(`characterId`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Fleet` ADD CONSTRAINT `Fleet_fcCharacterId_fkey` FOREIGN KEY (`fcCharacterId`) REFERENCES `User`(`characterId`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FleetDelegate` ADD CONSTRAINT `FleetDelegate_fleetId_fkey` FOREIGN KEY (`fleetId`) REFERENCES `Fleet`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FleetDelegate` ADD CONSTRAINT `FleetDelegate_characterId_fkey` FOREIGN KEY (`characterId`) REFERENCES `User`(`characterId`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FleetDelegate` ADD CONSTRAINT `FleetDelegate_grantedBy_fkey` FOREIGN KEY (`grantedBy`) REFERENCES `User`(`characterId`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Session` ADD CONSTRAINT `Session_fleetId_fkey` FOREIGN KEY (`fleetId`) REFERENCES `Fleet`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Session` ADD CONSTRAINT `Session_characterId_fkey` FOREIGN KEY (`characterId`) REFERENCES `User`(`characterId`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `QueueEntry` ADD CONSTRAINT `QueueEntry_fleetId_fkey` FOREIGN KEY (`fleetId`) REFERENCES `Fleet`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `QueueEntry` ADD CONSTRAINT `QueueEntry_submittedBy_fkey` FOREIGN KEY (`submittedBy`) REFERENCES `User`(`characterId`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `QueueEntry` ADD CONSTRAINT `QueueEntry_removedBy_fkey` FOREIGN KEY (`removedBy`) REFERENCES `User`(`characterId`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Vote` ADD CONSTRAINT `Vote_queueEntryId_fkey` FOREIGN KEY (`queueEntryId`) REFERENCES `QueueEntry`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Vote` ADD CONSTRAINT `Vote_characterId_fkey` FOREIGN KEY (`characterId`) REFERENCES `User`(`characterId`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Playback` ADD CONSTRAINT `Playback_fleetId_fkey` FOREIGN KEY (`fleetId`) REFERENCES `Fleet`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Playback` ADD CONSTRAINT `Playback_queueEntryId_fkey` FOREIGN KEY (`queueEntryId`) REFERENCES `QueueEntry`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
