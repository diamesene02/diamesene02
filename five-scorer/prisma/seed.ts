// v2 : plus de seed de roster — chaque club se crée depuis l'app
// (inscription → « Créer un club »). L'historique v1 éventuel est migré
// automatiquement par la migration 20260824190000_v2_platform dans un club
// "legacy" à revendiquer depuis /onboarding avec l'ancien PIN admin.
async function main() {
  console.log(
    "ℹ️  Rien à seeder : crée ton compte sur http://localhost:3000/signup puis ton club."
  );
}

main();
