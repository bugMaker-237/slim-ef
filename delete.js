/**
 * delete-js-files.js
 * Recursively deletes all .js, .d.ts, and .js.map files in a directory
 * excluding the node_modules folder.
 */

const fs = require('fs');
const path = require('path');

/**
 * Recursively deletes matching files in a directory.
 * @param {string} dir - Directory path to start from.
 */
function deleteMatchingFiles(dir) {
  // Skip node_modules
  if (path.basename(dir) === 'node_modules') {
    return;
  }

  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (err) {
    console.error(`Error reading directory: ${dir}`, err.message);
    return;
  }

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      deleteMatchingFiles(fullPath); // Recurse into subdirectory
    } else if (
      entry.isFile() &&
      (fullPath.endsWith('.js') ||
        fullPath.endsWith('.d.ts') ||
        fullPath.endsWith('.js.map')) &&
      !fullPath.endsWith('delete.js') // Exclude delete.js itself
    ) {
      try {
        fs.unlinkSync(fullPath);
        console.log(`Deleted: ${fullPath}`);
      } catch (err) {
        console.error(`Failed to delete: ${fullPath}`, err.message);
      }
    }
  }
}

// Run the script from the current working directory
const targetDir = process.argv[2] || process.cwd();
console.log(`Starting cleanup in: ${targetDir}`);
deleteMatchingFiles(targetDir);
console.log('Cleanup complete.');
