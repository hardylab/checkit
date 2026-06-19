// spec:[spec](specs/backend/rules/file/group-test-files.md#L1)
import type { ReviewRule, ReviewIssue, RuleContext } from '@checkit/shared';
import fs from 'fs';
import path from 'path';

declare module '@checkit/shared' {
  interface ReviewRuleRegistry {
    'group-test-files': {};
  }
}

export class GroupTestFilesRule implements ReviewRule {
  static id = 'group-test-files';
  id = GroupTestFilesRule.id;
  constructor(_: {}) {}
  check(context: RuleContext): ReviewIssue[] {
    const issues: ReviewIssue[] = [];
    const filesByDir: Record<string, string[]> = {};
    for (const file of context.files) {
      const dir = path.dirname(file);
      if (!filesByDir[dir]) {
        filesByDir[dir] = [];
      }
      filesByDir[dir].push(path.basename(file));
    }
    for (const [dir, files] of Object.entries(filesByDir)) {
      const fullPath = path.join(context.targetPath, dir);
      const dirName = path.basename(fullPath);
      if (dirName === 'test' || dirName === '__tests__') {
        continue;
      }
      const testFiles = files.filter(
        (file) => file.endsWith('.test.ts') || file.endsWith('.test.tsx')
      );
      const testDirName = ['test', '__tests__'].find((d) => fs.existsSync(path.join(fullPath, d)));
      if (testDirName) {
        if (testFiles.length > 0) {
          issues.push({
            type: 'structure',
            module: context.targetName,
            issue: `Found ${testFiles.length} test files in ${fullPath}. Move them to existing '${testDirName}/' directory?`,
            fixable: true,
            level: 'warning',
            data: {
              targetPath: fullPath,
              testFiles: testFiles,
              destinationDir: testDirName,
            },
          });
        }
      } else {
        if (testFiles.length >= 2) {
          issues.push({
            type: 'structure',
            module: context.targetName,
            issue: `Found ${testFiles.length} test files in ${fullPath}. Move them to 'test/' directory?`,
            fixable: true,
            level: 'warning',
            data: {
              targetPath: fullPath,
              testFiles: testFiles,
              destinationDir: 'test',
            },
          });
        }
      }
    }
    return issues;
  }
  fix(issue: ReviewIssue): boolean {
    if (!issue.data || !issue.data.targetPath || !Array.isArray(issue.data.testFiles)) {
      console.error('Missing data for group-test-files fix');
      return false;
    }
    const targetPath = issue.data.targetPath as string;
    const testFiles = issue.data.testFiles as string[];
    const destinationDirName = (issue.data.destinationDir as string) || 'test';
    const testDir = path.join(targetPath, destinationDirName);
    try {
      if (!fs.existsSync(testDir)) {
        fs.mkdirSync(testDir, { recursive: true });
      }
      for (const file of testFiles) {
        const oldPath = path.join(targetPath, file);
        const newPath = path.join(testDir, file);
        if (fs.existsSync(oldPath)) {
          if (
            file.endsWith('.ts') ||
            file.endsWith('.tsx') ||
            file.endsWith('.js') ||
            file.endsWith('.jsx')
          ) {
            const content = fs.readFileSync(oldPath, 'utf8');
            const relativeImportRegex =
              /(import\s+.*?\s+from\s+['"]|require\(['"]|import\(['"])(\.\.?\/.*?)(['"]\)?)/g;
            const newContent = content.replace(
              relativeImportRegex,
              (_match, prefix, importPath, suffix) => {
                const updatedPath = importPath.startsWith('./')
                  ? '../' + importPath.slice(2)
                  : '../' + importPath;
                return prefix + updatedPath + suffix;
              }
            );
            if (newContent !== content) {
              fs.writeFileSync(oldPath, newContent, 'utf8');
            }
          }
          fs.renameSync(oldPath, newPath);
        }
      }
      return true;
    } catch (e) {
      console.error('Failed to move test files', e);
      return false;
    }
  }
}
