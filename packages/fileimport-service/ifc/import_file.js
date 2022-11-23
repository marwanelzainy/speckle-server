const fs = require('fs')

const TMP_RESULTS_PATH = './import_result.json'

const { parseAndCreateCommit } = require('./index')

async function main() {
  const cmdArgs = process.argv.slice(2)

  const [filePath, userId, streamId, branchName, commitMessage, fileId] = cmdArgs

  // eslint-disable-next-line no-console
  console.log('ARGV: ', filePath, userId, streamId, branchName, commitMessage)

  const data = fs.readFileSync(filePath)

  const ifcInput = {
    data,
    streamId,
    userId,
    message: filePath + commitMessage || ' Imported file',
    fileId
  }
  if (branchName) ifcInput.branchName = branchName

  let output = {
    success: false,
    error: 'Unknown error'
  }
  const commitId = await parseAndCreateCommit(ifcInput)

  try {
    output = {
      success: true,
      commitId
    }
  } catch (err) {
    output = {
      success: false,
      error: err.toString()
    }
  }

  fs.writeFileSync(TMP_RESULTS_PATH, JSON.stringify(output))

  process.exit(0)
}

main()
