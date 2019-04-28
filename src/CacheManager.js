// @flow
import {FileSystem} from "expo";
import SHA1 from "crypto-js/sha1";

export type DownloadOptions = {
    md5?: boolean,
    headers?: { [string]: string }
};

let _baseDir = "expo-cache-folder";

const getTempDir = () => `${FileSystem.cacheDirectory}${_baseDir}`;
const getBaseDir = () => `${FileSystem.documentDirectory}${_baseDir}`;

export const setBaseDir = (baseDir: string): string => {
    _baseDir = baseDir;
};

export class CacheEntry {

    uri: string;
    options: DownloadOptions;
    path: string;

    constructor(uri: string, options: DownloadOptions) {
        this.uri = uri;
        this.options = options;
    }

    createBaseDir = async () => {
        const BASE_DIR = getBaseDir();
        const TEMP_DIR = getTempDir();
        const {exists} = FileSystem.getInfoAsync(BASE_DIR);
        if (!exists) {
            try {
                await FileSystem.makeDirectoryAsync(BASE_DIR, {intermediates: true});
                await FileSystem.makeDirectoryAsync(TEMP_DIR, {intermediates: true});
            } catch (err) {
                //do nothing
            }
        }
    };

    async getPath(permanent: boolean): Promise<?string> {
        const {uri, options} = this;
        const {path, exists, tmpPath} = await getCacheEntry(uri);
        if (exists) {
            return path;
        }
        this.createBaseDir();
        const result = await FileSystem.createDownloadResumable(uri, tmpPath, options)
            .downloadAsync();
        // If the image download failed, we don't cache anything
        if (result && result.status !== 200) {
            return undefined;
        }

        if (!permanent) {
            await FileSystem.moveAsync({from: tmpPath, to: path});
        }
        return path;
    }
}

const getCacheKey = (uri: string): string => SHA1(uri);

export default class CacheManager {

    static entries: { [uri: string]: CacheEntry } = {};

    static get(uri: string, options: DownloadOptions): CacheEntry {
        if (!CacheManager.entries[uri]) {
            CacheManager.entries[uri] = new CacheEntry(uri, options);
        }
        return CacheManager.entries[uri];
    }

    static async clearCache(): Promise<void> {
        await FileSystem.deleteAsync(TEMP_DIR, {idempotent: true});
        await FileSystem.makeDirectoryAsync(TEMP_DIR);
    }

    static async getCacheSize(): Promise<number> {
        const {size} = await FileSystem.getInfoAsync(TEMP_DIR, {size: true});
        return size;
    }
}

export const removeCacheEntry = async (uri: string, deletePermanent = false): Promise<> => {
    const key = getCacheKey(uri);

    if (deletePermanent) {
        await FileSystem.deleteAsync(`${getBaseDir()}${key}`, {idempotent: true});
    }

    return FileSystem.deleteAsync(
        `${getTempDir()}${key}`,
        {idempotent: true}
    );
};

const getCacheEntry = async (uri: string): Promise<{ exists: boolean, path: string, tmpPath: string }> => {
    const path = `${BASE_DIR}${SHA1(uri)}`;
    const tmpPath = `${TEMP_DIR}${SHA1(uri)}`;
    try {
        await FileSystem.makeDirectoryAsync(TEMP_DIR);
        await FileSystem.makeDirectoryAsync(BASE_DIR);
    } catch (e) {
        // do nothing
    }
    const info = await FileSystem.getInfoAsync(path);
    const {exists} = info;
    return {exists, path, tmpPath};
};
