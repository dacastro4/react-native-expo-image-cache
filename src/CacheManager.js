// @flow
import {FileSystem} from "expo";
import MD5 from "crypto-js/md5";

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
    permanent: boolean;

    constructor(uri: string, options: DownloadOptions) {
        this.uri = uri;
        this.options = options;
        this.permanent = false;
    }

    createBaseDir = async () => {
        try {
            await this.ensureFolderExists(getBaseDir());
            await this.ensureFolderExists(getTempDir());
        } catch (err) {
            // do nothing
        }
    };

    ensureFolderExists = (path: string) => {
        return FileSystem.getInfoAsync(path)
            .then(({exists}) => {
                if (!exists) {
                    return FileSystem.makeDirectoryAsync(path, {intermediates: true});
                }

                return Promise.resolve(true);
            });
    };

    async getPath(permanent: boolean): Promise<?string> {
        this.permanent = permanent;
        const {uri, options} = this;
        const {path, exists, tmpPath} = await getCacheEntry(uri, this.permanent);
        if (exists) {
            return permanent ? path : tmpPath;
        }
        this.createBaseDir();
        const result = await FileSystem.createDownloadResumable(uri, tmpPath, options)
            .downloadAsync();

        // If the image download failed, we don't cache anything
        if (result && result.status !== 200) {
            return undefined;
        }

        if (permanent) {
            await FileSystem.moveAsync({from: tmpPath, to: path});
        }
        return permanent ? path : tmpPath;
    }
}

export default class CacheManager {

    static entries: { [uri: string]: CacheEntry } = {};

    static get(uri: string, options: DownloadOptions): CacheEntry {
        if (!CacheManager.entries[uri]) {
            CacheManager.entries[uri] = new CacheEntry(uri, options);
        }
        return CacheManager.entries[uri];
    }

    static async clearCache(): Promise<void> {
        await FileSystem.deleteAsync(getTempDir(), {idempotent: true});
        await FileSystem.makeDirectoryAsync(getTempDir());
    }

    static async getCacheSize(): Promise<number> {
        const {size} = await FileSystem.getInfoAsync(getTempDir(), {size: true});
        return size;
    }
}

export const removeCacheEntry = async (uri: string, deletePermanent = false): Promise<> => {
    let deleted;

    if (deletePermanent) {
        await FileSystem.deleteAsync(`${getBaseDir()}/${MD5(uri)}.jpg`, {idempotent: true});
    }

    deleted = await FileSystem.deleteAsync(
        `${getTempDir()}/${MD5(uri)}.jpg`,
        {idempotent: true}
    )

    return deleted;
};

const getCacheEntry = async (uri: string, permanent: boolean): Promise<{ exists: boolean, path: string, tmpPath: string }> => {
    const path = `${getBaseDir()}/${MD5(uri)}.jpg`;
    const tmpPath = `${getTempDir()}/${MD5(uri)}.jpg`;
    try {
        await FileSystem.makeDirectoryAsync(getTempDir());
        await FileSystem.makeDirectoryAsync(getBaseDir());
    } catch (e) {
        // do nothing
    }
    const info = await FileSystem.getInfoAsync(permanent ? path : tmpPath);
    const {exists} = info;
    return {exists, path, tmpPath};
};
