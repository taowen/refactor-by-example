export interface RefactoredCodeBlock {
    insert: boolean;
    file: string;
    lineNumber: number;
    content: string[];
};

export function parseRefactoredCode(refactoredCode: string) {
    const blocks: RefactoredCodeBlock[] = [];
    let currentBlock: RefactoredCodeBlock | undefined;
    const lines = refactoredCode.split('\n')
    for(let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.startsWith('```')) {
            if (currentBlock === undefined) {
                i++;
                const nextLine = lines[i];
                if (nextLine.startsWith('//+')) {
                    const [file, lineNumberText] = nextLine.substring(3).split(':')
                    currentBlock = { insert: true, file, lineNumber: parseInt(lineNumberText), content: [] };
                } else {
                    const [file, lineNumberText] = nextLine.substring(2).split(':')
                    currentBlock = { insert: false, file, lineNumber: parseInt(lineNumberText), content: [] };
                }
            } else {
                blocks.push(currentBlock);
                currentBlock = undefined;
            }
            continue;
        }
        if (currentBlock) {
            currentBlock.content.push(line)
        }
    }
    return blocks;
}

// test case
if (require.main === module) {
    const refactoredCode = "```typescript\n//src/sample/vick-command.ts:1\nimport { ICommand } from \"./a,pi\";\n\nexport class VickCommand extends ICommand {\n}\n```\n```typescript\n//src/sample/app.ts:3\nimport { VickCommand } from \"./vick-command\";\n\n```\n```typescript\n//src/sample/app.ts:7\n    executeNewCommand(VickCommand);\n\n```\n```typescript\n//+src/sample/registry.ts:2\nimport { VickCommand } from \"./vick-command\";\n\nregisterNewCommand(VickCommand)\n```"
    const blocks = parseRefactoredCode(refactoredCode);
    if (blocks.length != 4) {
        throw new Error()
    }
}