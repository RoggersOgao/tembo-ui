import { db } from "../src/index.js";
import { seedPermissions } from "./seeds/permissions-seed.js";

async function main() {
  console.log('\n🌱 Start seeding...\n');
  console.log('='.repeat(60));

  const startTime = Date.now();

  try {
    console.log('\n[-] Seeding permissions...');
    await seedPermissions();

    const [ permissionCount, userCount] = await Promise.all([
      
      db.permission.count(),
      db.user.count(),
    ]);

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log('\n' + '='.repeat(60));
    console.log(' Seeding finished successfully!');
    console.log('='.repeat(60));
    console.log(`\n⏱️  Total time: ${duration}s\n`);
    console.log('📊 Database Statistics:');
    console.log(`   - Permissions: ${permissionCount}`);
    console.log(`   - Users:       ${userCount}\n`);
    console.log('💡 Next steps:');
    console.log('   1. Create your first admin user');
    console.log('   2. Users will automatically get role-based permissions');
    console.log('   3. Start your application\n');

  } catch (error) {
    console.error('\n[*] Seeding failed:', error);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error('Fatal error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });