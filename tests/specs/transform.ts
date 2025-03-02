import { testSuite, expect } from 'manten';
import { createFsRequire } from 'fs-require';
import { Volume } from 'memfs';
import { transform, transformSync } from '#esbuild-kit/core-utils';

const base64Module = (code: string) => `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`;

const fixtures = {
	ts: `
	const __filename = 'filename';
	const __dirname = 'dirname';
	try {
		const unusedVariable1 = 1;
	} catch (unusedError) {
		const unusedVariable2 = 2;
	}
	export default 'default value' as string;
	export const named: string = 'named';
	export const functionName: string = (function named() {}).name;
	`,

	esm: `
	const __filename = 'filename';
	const __dirname = 'dirname';
	try {
		const unusedVariable1 = 1;
	} catch (unusedError) {
		const unusedVariable2 = 2;
	}
	export default 'default value';
	export const named = 'named';
	export const functionName = (function named() {}).name;
	`,
};

export default testSuite(({ describe }) => {
	describe('transform', ({ describe }) => {
		describe('sync', ({ test }) => {
			test('transforms ESM to CJS', () => {
				const transformed = transformSync(
					fixtures.esm,
					'file.js',
					{ format: 'cjs' },
				);

				// For debuggers
				expect(transformed.code).toMatch('unusedVariable1');
				expect(transformed.code).toMatch('unusedVariable2');

				const fsRequire = createFsRequire(Volume.fromJSON({
					'/file.js': transformed.code,
				}));

				expect(fsRequire('/file.js')).toStrictEqual({
					default: 'default value',
					functionName: 'named',
					named: 'named',
				});
			});

			test('transforms file with inline sourcemap string', () => {
				expect(
					() => transformSync(
						`
						const inlineSourceMapPrefix = '\\n//# sourceMappingURL=data:application/json;base64,';
						import('fs');
						${fixtures.esm}`,
						'file.js',
						{ format: 'cjs' },
					),
				).not.toThrow();
			});

			test('sourcemap file', () => {
				const fileName = 'file.mts';
				const transformed = transformSync(
					fixtures.ts,
					fileName,
					{ format: 'esm' },
				);

				expect(transformed.map).not.toBe('');

				const { map } = transformed;

				expect(map.sources.length).toBe(1);
				expect(map.sources[0]).toBe(fileName);
				expect(map.names).toStrictEqual(['named']);
			});
		});

		describe('async', ({ test }) => {
			test('transforms TS to ESM', async () => {
				const transformed = await transform(
					fixtures.ts,
					'file.ts',
					{ format: 'esm' },
				);

				// For debuggers
				expect(transformed.code).toMatch('unusedVariable1');
				expect(transformed.code).toMatch('unusedVariable2');

				const imported = await import(base64Module(transformed.code));
				expect({ ...imported }).toStrictEqual({
					default: 'default value',
					functionName: 'named',
					named: 'named',
				});
			});

			test('sourcemap file', async () => {
				const fileName = 'file.cts';
				const transformed = await transform(
					fixtures.ts,
					fileName,
					{ format: 'esm' },
				);

				expect(transformed.map).not.toBe('');

				const { map } = transformed;
				expect(map.sources.length).toBe(1);
				expect(map.sources[0]).toBe(fileName);
				expect(map.names).toStrictEqual(['named']);
			});
		});
	});
});
