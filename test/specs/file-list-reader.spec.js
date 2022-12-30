const crypto = require('crypto');
const path = require('path');


const FileListReader = require('../../src/file-list-reader');


const {
    expectOwnPropertyNamesToEqual
} = require('./test-utils');


const expect = global.expect;


const testableDirname = path.resolve(__dirname, '../fixtures/test-recorder');


async function readStatsToEnd(flr) {
    return new Promise((resolve, reject) => {
        let cleanup = () => {};

        flr.on('error', err => {
            cleanup();
            reject(err);
        });

        const stats = {
            length: 0,
            hash: null,
            readCallCount: 0,
        };

        const originalMethod = flr._read;

        cleanup = () => {
            flr._read = originalMethod;
        };

        flr._read = jest.fn((...args) => {
            stats.readCallCount += 1;
            return originalMethod.apply(flr, args);
        });


        const hasher = crypto.createHash('sha256');

        flr.on('readable', () => {
            let chunk;
            while ((chunk = flr.read()) != null) {
                stats.length += chunk.length;
                hasher.update(chunk);
            }
        });

        flr.on('end', () => {
            stats.hash = hasher.digest('hex');
            cleanup();
            resolve(stats);
        });
    });
}


describe('FileListReader', () => {

    it('should be a class', () => {
        expect(typeof FileListReader).toBe('function');

        expectOwnPropertyNamesToEqual(FileListReader.prototype, [
            'constructor',
            '_read',
        ]);

        expectOwnPropertyNamesToEqual(FileListReader, [
            'getListOfFiles',

            'length',
            'name',
            'prototype',
        ]);
    });

    describe('#constructor', () => {

        it('should work correctly', () => {
            const flr = new FileListReader({
                dirname: testableDirname,
                minDatecode: 20220101,
                maxDatecode: 20221231,
            });

            expectOwnPropertyNamesToEqual(flr, [
                'dirname',
                'minDatecode',
                'maxDatecode',
                'files',
                'fileIndex',

                // base-class related
                '_events',
                '_eventsCount',
                '_maxListeners',
                '_readableState',
            ]);

            expect(flr.dirname).toBe(testableDirname);
            expect(flr.minDatecode).toBe('20220101');
            expect(flr.maxDatecode).toBe('20221231');
            expect(flr.files).toBe(null);
            expect(flr.fileIndex).toBe(0);
        });

    });

    describe('Readable interface', () => {

        it('should work correctly', async () => {
            const flr = new FileListReader({ dirname: testableDirname });

            const stats = await readStatsToEnd(flr);

            expect(stats.length).toBe(931336);
            expect(stats.hash).toBe('d2f70dcaf27e6ed80a4cf94d9353244e6e9ed740f8074fcfb2ca2ea6fe05cca6');
        });

        it('should report errors', async () => {
            const flr = new FileListReader({ dirname: testableDirname });

            // manually set list of unknown files for testing purposes
            flr.files = [
                path.resolve(testableDirname, 'unknown-file.txt'),
            ];

            let error, hasError;
            try {
                const stats = await readStatsToEnd(flr);
                hasError = false;
            } catch (err) {
                error = err;
                hasError = true;
            }

            expect(hasError).toBe(true);
            expect(error.code).toBe('ENOENT');
        });

    });

    describe('.getListOfFiles', () => {

        function normalizeFilenames(filenames) {
            return filenames.map(filename => filename.replace(testableDirname, '${testableDirname}'));
        }

        it('should work correctly', async () => {
            let result;

            result = await FileListReader.getListOfFiles(testableDirname, null, null);

            expect(normalizeFilenames(result)).toEqual([
                '${testableDirname}/20140214_packets.vbus',
                '${testableDirname}/20140215_packets.vbus',
                '${testableDirname}/20140216_packets.vbus',
            ]);

            result = await FileListReader.getListOfFiles(testableDirname, '20140215', null);

            expect(normalizeFilenames(result)).toEqual([
                '${testableDirname}/20140215_packets.vbus',
                '${testableDirname}/20140216_packets.vbus',
            ]);

            result = await FileListReader.getListOfFiles(testableDirname, null, '20140215');

            expect(normalizeFilenames(result)).toEqual([
                '${testableDirname}/20140214_packets.vbus',
                '${testableDirname}/20140215_packets.vbus',
            ]);
        });

    });

});