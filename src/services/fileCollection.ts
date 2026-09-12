import type { FileWithPath } from "../types/analysis";

interface LegacyFileEntry {
  isFile: boolean;
  isDirectory: boolean;
  name: string;
  file: (callback: (file: FileWithPath) => void) => void;
  createReader: () => {
    readEntries: (callback: (entries: LegacyFileEntry[]) => void) => void;
  };
}

async function readEntry(entry: LegacyFileEntry, basePath = ""): Promise<FileWithPath[]> {
  if (entry.isFile) {
    return new Promise((resolve) => {
      entry.file((file) => {
        const path = `${basePath}${file.name}`;
        try {
          Object.defineProperty(file, "webkitRelativePath", {
            value: path,
            configurable: true,
          });
        } catch {
          file.relativePathForDisplay = path;
        }
        resolve([file]);
      });
    });
  }

  if (!entry.isDirectory) return [];

  const reader = entry.createReader();
  const entries: LegacyFileEntry[] = [];
  let batch: LegacyFileEntry[] = [];
  do {
    batch = await new Promise((resolve) => reader.readEntries(resolve));
    entries.push(...batch);
  } while (batch.length > 0);

  const children = await Promise.all(
    entries.map((child) => readEntry(child, `${basePath}${entry.name}/`)),
  );
  return children.flat();
}

export async function collectDroppedFiles(dataTransfer: DataTransfer): Promise<FileWithPath[]> {
  const items = Array.from(dataTransfer.items || []);
  if (!items.length) return Array.from(dataTransfer.files) as FileWithPath[];

  const files: FileWithPath[] = [];
  for (const item of items) {
    const getEntry = (item as unknown as {
      webkitGetAsEntry?: () => LegacyFileEntry | null;
    }).webkitGetAsEntry;
    const entry = getEntry?.call(item);
    if (entry) files.push(...(await readEntry(entry)));
    else {
      const file = item.getAsFile() as FileWithPath | null;
      if (file) files.push(file);
    }
  }
  return files;
}

export function isReportFile(file: File): boolean {
  return /\.xml$/i.test(file.name);
}

export function isImageFile(file: File): boolean {
  return /\.(png|jpe?g|gif|webp)$/i.test(file.name);
}
