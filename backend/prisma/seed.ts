import 'dotenv/config'

import seedDatabase from '../src/utils/seed.js'

async function main() {
  await seedDatabase()
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })