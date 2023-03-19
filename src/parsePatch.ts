const hashRegex = /^From (\S*)/
const authorRegex = /^From:\s?([^<].*[^>])?\s+(<(.*)>)?/
const fileNameRegex = /^diff --git "?a\/(.*)"?\s*"?b\/(.*)"?/
const fileLinesRegex = /^@@ -([0-9]*),?\S* \+([0-9]*),?/
const similarityIndexRegex = /^similarity index /
const addedFileModeRegex = /^new file mode /
const deletedFileModeRegex = /^deleted file mode /

export type ParsedPatchModifiedLineType = {
  added: boolean
  lineNumber: number
  line: string
}

export type ParsedPatchFileDataType = {
  added: boolean
  deleted: boolean
  beforeName: string
  afterName: string
  modifiedLines: ParsedPatchModifiedLineType[]
}

export type ParsedPatchType = {
  hash: string
  authorName: string
  authorEmail: string
  date: string
  message: string
  files: ParsedPatchFileDataType[]
}

function parseGitPatch(patch: string) {
  if (typeof patch !== 'string') {
    throw new Error('Expected first argument (patch) to be a string')
  }

  const lines = patch.split('\n')

  const hashLine = lines.shift()

  if (!hashLine) return null

  const match1 = hashLine.match(hashRegex)

  if (!match1) return null

  const [, hash] = match1
  const authorLine = lines.shift()

  if (!authorLine) return null

  const match2 = authorLine.match(authorRegex)

  if (!match2) return null

  const [, authorName,, authorEmail] = match2

  const dateLine = lines.shift()

  if (!dateLine) return null

  const [, date] = dateLine.split('Date: ')

  const messageLine = lines.shift()

  if (!messageLine) return null

  const [, message] = messageLine.split('Subject: ')

  const parsedPatch: ParsedPatchType = {
    hash,
    authorName,
    authorEmail,
    date,
    message,
    files: [],
  }

  splitIntoParts(lines, 'diff --git').forEach(diff => {
    const fileNameLine = diff.shift()

    if (!fileNameLine) return

    const match3 = fileNameLine.match(fileNameRegex)

    if (!match3) return

    const [, a, b] = match3
    const metaLine = diff.shift()

    if (!metaLine) return

    const fileData: ParsedPatchFileDataType = {
      added: false,
      deleted: false,
      beforeName: a.trim(),
      afterName: b.trim(),
      modifiedLines: [],
    }

    parsedPatch.files.push(fileData)

    if (addedFileModeRegex.test(metaLine)) {
      fileData.added = true
    }
    if (deletedFileModeRegex.test(metaLine)) {
      fileData.deleted = true
    }
    if (similarityIndexRegex.test(metaLine)) {
      return
    }

    splitIntoParts(diff, '@@ ').forEach(lines => {
      const fileLinesLine = lines.shift()

      if (!fileLinesLine) return

      const match4 = fileLinesLine.match(fileLinesRegex)

      if (!match4) return

      const [, a, b] = match4

      let nA = parseInt(a)
      let nB = parseInt(b)

      lines.forEach(line => {
        nA++
        nB++

        if (line.startsWith('-- ')) {
          return
        }
        if (line.startsWith('+')) {
          nA--

          fileData.modifiedLines.push({
            added: true,
            lineNumber: nB,
            line: line.substr(1),
          })
        }
        else if (line.startsWith('-')) {
          nB--

          fileData.modifiedLines.push({
            added: false,
            lineNumber: nA,
            line: line.substr(1),
          })
        }
      })
    })
  })

  return parsedPatch
}

function splitIntoParts(lines: string[], separator: string) {
  const parts = []
  let currentPart: string[] | undefined

  lines.forEach(line => {
    if (line.startsWith(separator)) {
      if (currentPart) {
        parts.push(currentPart)
      }

      currentPart = [line]
    }
    else if (currentPart) {
      currentPart.push(line)
    }
  })

  if (currentPart) {
    parts.push(currentPart)
  }

  return parts
}

export default parseGitPatch

interface Block {
    oldFile: string;
    newFile: string;
    oldFileLineNumber: number;
    oldContent: string;
    newContent: string;
}

export function parsePatch(patchContent: string) {
    const lines = patchContent.split('\n')
    const oldBlock: string[] = []
    const newBlock: string[] = []
    const blocks: Block[] = []
    let currentDiff:string = '';
    let oldFileLineNumber = 0;
    for (const [i, line] of lines.entries()) {
        if (line.startsWith('diff --git ') || i === lines.length - 1) {
            if (currentDiff) {
                const [oldFile, newFile] = currentDiff.split(' ');
                blocks.push({
                    oldFileLineNumber,
                    oldFile: oldFile.substring(2),
                    newFile: newFile.substring(2),
                    oldContent: oldBlock.slice(0, oldBlock.length - 1).join('\n'),
                    newContent: newBlock.slice(0, newBlock.length - 1).join('\n')
                })
            }
            currentDiff = line.substring('diff --git '.length)
            continue
        }
        if (line.startsWith('--- ') || line.startsWith('+++ ')) {
            continue;
        }
        if (line.startsWith('@@ -')) {
            oldFileLineNumber = parseInt(line.substring(4, line.indexOf(',')));
            oldBlock.length = 0;
            newBlock.length = 0;
            continue;
        }
        if (line.startsWith('+')) {
            newBlock.push(line.substring(1))
        } else if (line.startsWith('-')) {
            oldBlock.push(line.substring(1))
        } else {
            oldBlock.push(line.substring(1))
            newBlock.push(line.substring(1))
        }
    }
    return blocks;
}

// test case
if (require.main === module) {
    const blocks = parsePatch(`
commit 1427971b3ee60a1df71b4c6cc34ed63eb623edf9 (HEAD -> main, origin/main)
Author: Tao Wen <taowen@gmail.com>
Date:   Sun Mar 19 21:22:49 2023 +0800

    a refactoring example

diff --git a/src/sample/app.ts b/src/sample/app.ts
index 08a7066..32c9506 100644
--- a/src/sample/app.ts
+++ b/src/sample/app.ts
@@ -1,8 +1,8 @@
-import { executeOldCommand } from "./api";
+import { executeNewCommand, executeOldCommand } from "./api";
 import { BrobCommand } from "./brob-command";
 import { VickCommand } from "./vick-command";
 
 export function main() {
-    executeOldCommand(BrobCommand);
+    executeNewCommand(BrobCommand);
     executeOldCommand(VickCommand);
 }
\\ No newline at end of file
diff --git a/src/sample/brob-command.ts b/src/sample/brob-command.ts
index fbae3db..31672c1 100644
--- a/src/sample/brob-command.ts
+++ b/src/sample/brob-command.ts
@@ -1,2 +1,4 @@
-export class BrobCommand {
+import { ICommand } from "./api";
+
+export class BrobCommand extends ICommand {
 }
\\ No newline at end of file
diff --git a/src/sample/registry.ts b/src/sample/registry.ts
new file mode 100644
index 0000000..3a5ea14
--- /dev/null
+++ b/src/sample/registry.ts
@@ -0,0 +1,4 @@
+import { registerNewCommand } from "./api";
+import { BrobCommand } from "./brob-command";
+
+registerNewCommand(BrobCommand)
\\ No newline at end of file
    `)
    if (blocks.length != 3) {
        throw new Error()
    }
}