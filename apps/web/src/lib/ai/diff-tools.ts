interface DiffAnalysis {
  total_changes: number;
  insertions: number;
  deletions: number;
  unchanged: number;
  insertion_chars: number;
  deletion_chars: number;
  unchanged_chars: number;
}

export function analyzeFastDiff(
  changes: Array<[number, string]>
): DiffAnalysis {
  let insertions = 0;
  let deletions = 0;
  let unchanged = 0;
  let insertion_chars = 0;
  let deletion_chars = 0;
  let unchanged_chars = 0;

  for (const [operation, text] of changes) {
    switch (operation) {
      case -1: // deletion
        deletions++;
        deletion_chars += text.length;
        break;
      case 0: // unchanged
        unchanged++;
        unchanged_chars += text.length;
        break;
      case 1: // insertion
        insertions++;
        insertion_chars += text.length;
        break;
    }
  }

  return {
    total_changes: insertions + deletions,
    insertions,
    deletions,
    unchanged,
    insertion_chars,
    deletion_chars,
    unchanged_chars,
  };
}

export function formatDiffOutput(changes: Array<[number, string]>): string[] {
  const formatted: string[] = [];

  for (const [operation, text] of changes) {
    const lines = text.split("\n");

    for (const line of lines) {
      if (line === "" && lines.length === 1) continue; // Skip empty single lines

      switch (operation) {
        case -1:
          formatted.push(`- ${line}`);
          break;
        case 0:
          formatted.push(`  ${line}`);
          break;
        case 1:
          formatted.push(`+ ${line}`);
          break;
      }
    }
  }

  return formatted;
}

export function validateReplacement(
  changes: Array<[number, string]>,
  replacement: { find: string; replace: string }
): { valid: boolean; reason?: string } {
  // Check if the replacement is too broad (affects too much content)
  const totalChanges = changes.filter(([op]) => op !== 0).length;

  if (totalChanges > 10) {
    return {
      valid: false,
      reason: `Replacement affects too many parts of the file (${totalChanges} changes)`,
    };
  }

  // Check if we're accidentally deleting important content
  const deletions = changes.filter(([op]) => op === -1);
  const hasLargeDeletions = deletions.some(
    ([, text]) => text.length > replacement.find.length * 2
  );

  if (hasLargeDeletions) {
    return {
      valid: false,
      reason: "Replacement would delete more content than expected",
    };
  }

  return { valid: true };
}
