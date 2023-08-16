/**
 * This copies the readme and license files to every package before publishing them.
 */
import { copyFile } from 'fs/promises'

async function copy(pckg: string) {
  await Promise.all([
    copyFile('./LICENSE.txt', `./packages/${pckg}/LICENSE.txt`),
    copyFile('./README.md', `./packages/${pckg}/README.md`),
  ])
}

async function start() {
  try {
    await Promise.all(['backend', 'client', 'react', 'shared'].map(copy))
    process.exit(0)
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(error)
    process.exit(1)
  }
}

start()
