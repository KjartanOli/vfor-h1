import {
    access,
    mkdir,
    writeFile as fsWriteFile,
    readFile as fsReadFile,
    stat as fsStat,
    readdir as fsReadDir,
  } from 'fs/promises'; // eslint-disable-line import/no-unresolved
  import { constants } from 'fs';
  
export async function stat(file: string) {
    let result = null;
    try {
        result = await fsStat(file);
    } catch (e) {
        // empty
    }
    return result;
}
  
  export async function exists(file: string) {
    let ok = true;
    try {
      await access(file, constants.F_OK);
    } catch (e) {
      ok = false;
    }
    return ok;
  }
  
export async function isReadable(dir: string) {
    let readable = true;
    try {
        await access(dir, constants.R_OK);
    } catch (e) {
        readable = false;
    }

    return readable;
}
  
export async function readFile(file: string, encoding: BufferEncoding | undefined = 'utf8') {
    if (!(await isReadable(file))) {
        return null;
    }

    const content = await fsReadFile(file);

    if (!encoding) {
        return content;
    }

    return content.toString(encoding);
}
  
  export async function createDir(dir: string) {
    await mkdir(dir, { recursive: true });
  }
  
export async function writeFile(
    file: string,
    data: any,
    encoding: BufferEncoding | null | undefined = 'utf8',
) {
    return fsWriteFile(file, data, { encoding });
}
  
  export async function isWriteable(dir: string) {
    let writeable = true;
    try {
      await access(dir, constants.W_OK);
    } catch (e) {
      writeable = false;
    }
  
    return writeable;
  }
  
  export async function prepareDir(dir: string) {
    if (!(await exists(dir))) {
      await createDir(dir);
    }
    return isWriteable(dir);
  }
  
export async function readDir(dir: string) {
    let results: string[] = []; // Explicitly type the 'results' variable as an array of strings.
    try {
        results = await fsReadDir(dir);
    } catch {
        // empty
    }
    return results;
}
  