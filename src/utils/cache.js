const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

class Cache {
    constructor(options = {}) {
        this.cacheDir = options.cacheDir || path.join(__dirname, '../../.cache');
        this.defaultTTL = options.defaultTTL || 300000; // 5 minutes default
        this.maxSize = options.maxSize || 100; // Max number of cached items
        this.memoryCache = new Map();
    }

    async initialize() {
        try {
            await fs.mkdir(this.cacheDir, { recursive: true });
        } catch (error) {
            console.warn(`Could not create cache directory: ${error.message}`);
        }
    }

    generateKey(input) {
        // Create a hash key from the input
        const hash = crypto.createHash('md5');
        hash.update(typeof input === 'string' ? input : JSON.stringify(input));
        return hash.digest('hex');
    }

    async get(key, options = {}) {
        const { useMemory = true, useDisk = true } = options;
        const cacheKey = this.generateKey(key);

        // Check memory cache first
        if (useMemory && this.memoryCache.has(cacheKey)) {
            const cached = this.memoryCache.get(cacheKey);
            if (this.isValid(cached)) {
                return cached.data;
            } else {
                this.memoryCache.delete(cacheKey);
            }
        }

        // Check disk cache
        if (useDisk) {
            try {
                const filePath = path.join(this.cacheDir, `${cacheKey}.json`);
                const fileContent = await fs.readFile(filePath, 'utf8');
                const cached = JSON.parse(fileContent);

                if (this.isValid(cached)) {
                    // Load back into memory cache
                    if (useMemory) {
                        this.memoryCache.set(cacheKey, cached);
                    }
                    return cached.data;
                } else {
                    // Remove expired cache file
                    await fs.unlink(filePath).catch(() => {});
                }
            } catch (error) {
                // Cache miss or error reading cache
            }
        }

        return null;
    }

    async set(key, data, options = {}) {
        const { ttl = this.defaultTTL, useMemory = true, useDisk = true } = options;
        const cacheKey = this.generateKey(key);
        const expiry = Date.now() + ttl;

        const cacheItem = {
            data,
            expiry,
            created: Date.now()
        };

        // Store in memory cache
        if (useMemory) {
            this.memoryCache.set(cacheKey, cacheItem);
            this.enforceMemoryLimit();
        }

        // Store in disk cache
        if (useDisk) {
            try {
                const filePath = path.join(this.cacheDir, `${cacheKey}.json`);
                await fs.writeFile(filePath, JSON.stringify(cacheItem), 'utf8');
            } catch (error) {
                console.warn(`Could not write to disk cache: ${error.message}`);
            }
        }
    }

    isValid(cacheItem) {
        return cacheItem && cacheItem.expiry > Date.now();
    }

    enforceMemoryLimit() {
        if (this.memoryCache.size <= this.maxSize) {
            return;
        }

        // Remove oldest items first (simple LRU)
        const entries = Array.from(this.memoryCache.entries());
        entries.sort((a, b) => a[1].created - b[1].created);

        const toRemove = entries.slice(0, entries.length - this.maxSize);
        toRemove.forEach(([key]) => {
            this.memoryCache.delete(key);
        });
    }

    async clear(options = {}) {
        const { clearMemory = true, clearDisk = true } = options;

        if (clearMemory) {
            this.memoryCache.clear();
        }

        if (clearDisk) {
            try {
                const files = await fs.readdir(this.cacheDir);
                const jsonFiles = files.filter(file => file.endsWith('.json'));

                await Promise.all(
                    jsonFiles.map(file =>
                        fs.unlink(path.join(this.cacheDir, file)).catch(() => {})
                    )
                );
            } catch (error) {
                console.warn(`Could not clear disk cache: ${error.message}`);
            }
        }
    }

    async cleanup() {
        // Remove expired items from disk cache
        try {
            const files = await fs.readdir(this.cacheDir);
            const jsonFiles = files.filter(file => file.endsWith('.json'));

            for (const file of jsonFiles) {
                try {
                    const filePath = path.join(this.cacheDir, file);
                    const content = await fs.readFile(filePath, 'utf8');
                    const cached = JSON.parse(content);

                    if (!this.isValid(cached)) {
                        await fs.unlink(filePath);
                    }
                } catch (error) {
                    // If we can't read the file, remove it
                    await fs.unlink(path.join(this.cacheDir, file)).catch(() => {});
                }
            }
        } catch (error) {
            console.warn(`Cache cleanup failed: ${error.message}`);
        }
    }

    getStats() {
        return {
            memoryItems: this.memoryCache.size,
            maxSize: this.maxSize,
            defaultTTL: this.defaultTTL,
            cacheDir: this.cacheDir
        };
    }
}

module.exports = Cache;
