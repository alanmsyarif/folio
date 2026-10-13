// Reads and writes an exported book folder with the File System Access API (Chromium only).
const M = window.FolioModel;

async function writeFile(dir, name, data) {
  const w = await (await dir.getFileHandle(name, { create: true })).createWritable();
  await w.write(data);
  await w.close();
}

async function entryNames(dir, kind) {
  const names = [];
  for await (const [name, handle] of dir.entries()) if (!kind || handle.kind === kind) names.push(name);
  return names;
}

async function readBlob(root, path) {
  const [folder, name] = path.split('/');
  const file = await (await (await root.getDirectoryHandle(folder)).getFileHandle(name)).getFile();
  // Copy into memory: a File read from this folder goes stale once Export rewrites it.
  return new Blob([await file.arrayBuffer()], { type: file.type });
}

export async function exportBook(book, blobs) {
  // Fetch the viewer template before touching the folder, so a failure writes nothing.
  const template = await Promise.all(M.VIEWER_FILES.map(async ([from, to]) => {
    const res = await fetch('../' + from);
    if (!res.ok) throw new Error('Viewer file missing: ' + from);
    return [to, await res.blob()];
  }));

  const root = await window.showDirectoryPicker({ id: 'folio', mode: 'readwrite' });
  const files = await entryNames(root, 'file');
  for (const folder of ['pages', 'media']) {
    try {
      for (const name of await entryNames(await root.getDirectoryHandle(folder), 'file')) files.push(folder + '/' + name);
    } catch { /* no such folder yet */ }
  }
  const bookText = files.includes('book.js')
    ? await (await (await root.getFileHandle('book.js')).getFile()).text()
    : null;
  const plan = M.exportPlan(book, { folder: root.name, bookText, files });
  if (plan.ask && !confirm(plan.ask)) return null;

  for (const [to, blob] of template) await writeFile(root, to, blob);
  for (const path of M.usedPaths(book)) {
    const [folder, name] = path.split('/');
    await writeFile(await root.getDirectoryHandle(folder, { create: true }), name, blobs.get(path));
  }
  for (const path of plan.remove) {
    const [folder, name] = path.split('/');
    await (await root.getDirectoryHandle(folder)).removeEntry(name);
  }
  // Written last: a folder only counts as a book once everything it points to is there.
  await writeFile(root, 'book.js', M.serializeBook(book));
  return root.name;
}

export async function openBook() {
  const root = await window.showDirectoryPicker({ id: 'folio', mode: 'read' });
  let text;
  try {
    text = await (await (await root.getFileHandle('book.js')).getFile()).text();
  } catch {
    throw new Error(`No book.js in "${root.name}". Pick a folder made by Export.`);
  }
  const book = M.parseBookJs(text);
  const blobs = new Map();
  for (const path of M.usedPaths(book)) {
    try {
      blobs.set(path, await readBlob(root, path));
    } catch {
      throw new Error(`"${root.name}" is missing ${path}`);
    }
  }
  return { book, blobs };
}
