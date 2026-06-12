import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const characterId = parseInt(
    process.env.SEED_OPERATOR_CHARACTER_ID ?? "",
    10
  );

  if (!characterId || isNaN(characterId)) {
    throw new Error(
      "SEED_OPERATOR_CHARACTER_ID env var is required. " +
        "Set it to your EVE Online character ID before seeding."
    );
  }

  const characterName =
    process.env.SEED_OPERATOR_CHARACTER_NAME ?? "Operator";

  const user = await db.user.upsert({
    where: { characterId },
    update: { isOperator: true },
    create: { characterId, characterName, isOperator: true },
  });

  console.log(
    `Operator bootstrapped: ${user.characterName} (${user.characterId})`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
