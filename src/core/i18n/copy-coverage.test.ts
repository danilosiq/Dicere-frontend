import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { expect, it } from "vitest";

function componentFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return componentFiles(path);
    return path.endsWith(".tsx") && !path.includes(".test.") ? [path] : [];
  });
}

it("keeps interface copy out of hardcoded JSX text and attributes", () => {
  const uncovered: string[] = [];
  const paths = ["components", "features", "forms"].flatMap((directory) =>
    componentFiles(join(process.cwd(), "src/core", directory)),
  );
  paths.push(...componentFiles(join(process.cwd(), "src/app")));
  for (const path of paths) {
    const file = ts.createSourceFile(
      path,
      readFileSync(path, "utf8"),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );
    function visit(node: ts.Node) {
      if (
        ts.isJsxText(node) &&
        /[\p{L}]/u.test(node.text) &&
        node.text.trim() !== "Dicere"
      )
        uncovered.push(`${path}: ${node.text.trim()}`);
      if (
        ts.isJsxAttribute(node) &&
        /^(label|placeholder|tooltip|aria-label|ariaLabel|title|alt)$/.test(
          node.name.getText(file),
        ) &&
        node.initializer &&
        ts.isStringLiteral(node.initializer) &&
        node.initializer.text &&
        node.initializer.text !== "Dicere"
      )
        uncovered.push(`${path}: ${node.initializer.text}`);
      ts.forEachChild(node, visit);
    }
    visit(file);
  }
  expect(uncovered).toEqual([]);
});
