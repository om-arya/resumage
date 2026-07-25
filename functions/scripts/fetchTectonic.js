// Downloads a pinned Tectonic release (static musl x86_64 Linux build — matches
// the Cloud Functions 2nd-gen / Cloud Run container architecture) into
// functions/bin/tectonic. Runs as this package's postinstall hook so both local
// `npm install` and Firebase's Cloud Build deploy pipeline end up with the binary.
import { createWriteStream, existsSync, chmodSync, mkdirSync, rmSync } from 'node:fs'
import { pipeline } from 'node:stream/promises'
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import os from 'node:os'
import { fileURLToPath } from 'node:url'

const TECTONIC_VERSION = '0.16.9'
const ASSET_NAME = `tectonic-${TECTONIC_VERSION}-x86_64-unknown-linux-musl.tar.gz`
const DOWNLOAD_URL = `https://github.com/tectonic-typesetting/tectonic/releases/download/tectonic%40${TECTONIC_VERSION}/${ASSET_NAME}`

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const binDir = path.join(__dirname, '..', 'bin')
const binaryPath = path.join(binDir, 'tectonic')

async function downloadFile(url, destPath) {
  const response = await fetch(url, { redirect: 'follow' })
  if (!response.ok || !response.body) {
    throw new Error(`Failed to download ${url}: HTTP ${response.status}`)
  }
  await pipeline(response.body, createWriteStream(destPath))
}

async function main() {
  if (existsSync(binaryPath)) {
    console.log(`[fetchTectonic] ${binaryPath} already present, skipping download.`)
    return
  }

  mkdirSync(binDir, { recursive: true })
  const tmpDir = mkdirSync(path.join(os.tmpdir(), 'tectonic-download-'), { recursive: true }) ?? os.tmpdir()
  const archivePath = path.join(tmpDir, ASSET_NAME)

  console.log(`[fetchTectonic] Downloading Tectonic ${TECTONIC_VERSION} (${ASSET_NAME})...`)
  await downloadFile(DOWNLOAD_URL, archivePath)

  console.log('[fetchTectonic] Extracting...')
  execFileSync('tar', ['-xzf', archivePath, '-C', binDir], { stdio: 'inherit' })

  chmodSync(binaryPath, 0o755)
  rmSync(archivePath, { force: true })

  console.log(`[fetchTectonic] Tectonic ${TECTONIC_VERSION} ready at ${binaryPath}`)
}

main().catch((err) => {
  console.error('[fetchTectonic] Failed to fetch the Tectonic binary.')
  console.error(err)
  console.error(
    '[fetchTectonic] compileLatex will not work until functions/bin/tectonic exists. ' +
      `You can fetch it manually from ${DOWNLOAD_URL} and extract the "tectonic" binary into functions/bin/.`,
  )
  process.exitCode = 1
})
