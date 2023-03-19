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