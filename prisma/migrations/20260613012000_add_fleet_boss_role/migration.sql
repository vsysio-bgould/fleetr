ALTER TABLE `Session`
    MODIFY `role` ENUM('LINE_MEMBER', 'FLEET_BOSS', 'FLEET_COMMANDER', 'FC_DELEGATE') NOT NULL;

UPDATE `Session` AS `s`
JOIN `Fleet` AS `f`
    ON `s`.`fleetId` = `f`.`id`
   AND `s`.`characterId` = `f`.`fcCharacterId`
SET `s`.`role` = 'FLEET_BOSS'
WHERE `s`.`role` = 'FLEET_COMMANDER';
