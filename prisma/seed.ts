import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const existingOperators = await db.user.count({ where: { isOperator: true } });
  if (existingOperators > 0) {
    console.log(`Already initialized (${existingOperators} operator(s) exist) — skipping seed.`);
    return;
  }

  const characterId = parseInt(
    process.env.SEED_OPERATOR_CHARACTER_ID ?? "",
    10
  );

  if (!characterId || isNaN(characterId)) {
    throw new Error(
      "Fresh database detected but SEED_OPERATOR_CHARACTER_ID is not set. " +
        "Set it to your EVE Online character ID so the operator account can be bootstrapped."
    );
  }

  const characterName =
    process.env.SEED_OPERATOR_CHARACTER_NAME || "Operator";

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
