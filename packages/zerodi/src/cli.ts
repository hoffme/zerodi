const generateOutput = (params: {
	providerMap: string;
	types: string;
	providersEager: string;
}) => `import { Provider } from 'zerodi';

const providers = {
	${params.providerMap}
};

declare module 'zerodi' {
	interface ProvidersMap {
		${params.types}
	}
}

Provider.get = async (keys) => {
	const results = await Promise.all(
		Object.entries(keys).map(async ([key, providerKey]) => {
			const importFn = providers[providerKey];
			if (!importFn) {
				throw new Error(\`Provider '\${providerKey}' not found\`);
			}

			const provider = await importFn();

			return [key, provider] as const;
		})
	);

	return Object.fromEntries(results) as any;
};

export const startProviders = async () => {
	const providers = await Provider.get({
		${params.providersEager}
	});

	return Object.fromEntries(
		await Promise.all(
			Object.entries(providers).map(async ([key, provider]) => {
				const instance = await provider.get();
				return [key, instance] as const;
			})
		)
	);
};
`;

const generate = async () => {
	const { mkdir, readdir, writeFile } = await import('node:fs/promises');
	const { dirname, join, relative } = await import('node:path');
	const { cwd } = await import('node:process');
	const ts = await import('typescript');

	const output = process.argv.find((_, index) => {
		return index > 0 && process.argv[index - 1] === '--output';
	});

	const config = {
		root: cwd(),
		path: output || 'src/zerodi.ts',
	};

	const outputPath = join(config.root, config.path);

	await writeFile(outputPath, generateOutput({ providerMap: '', types: '', providersEager: '' }));

	const paths = await readdir(config.root, { recursive: true });

	const tsFiles = paths
		.filter((p) => p.endsWith('.ts') && !p.includes('node_modules'))
		.map((p) => join(config.root, p));

	const program = ts.createProgram({
		rootNames: tsFiles,
		options: {
			target: ts.ScriptTarget.ESNext,
			module: ts.ModuleKind.ESNext,
		},
	});

	const checker = program.getTypeChecker();

	const contents: {
		import_path: string;
		property: string;
		key: string;
		eager: boolean;
		hidden: boolean;
	}[] = [];

	for (const sourceFile of program.getSourceFiles()) {
		if (sourceFile.fileName.includes('node_modules') || !sourceFile.fileName.endsWith('.ts')) {
			continue;
		}

		const outDir = dirname(config.path);
		const rel = relative(outDir, sourceFile.fileName).replace(/\.ts$/, '');
		const import_path = rel.startsWith('.') ? rel : `./${rel}`;

		ts.forEachChild(sourceFile, (node) => {
			if (!ts.isVariableStatement(node)) return;
			if (!node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)) return;

			for (const decl of node.declarationList.declarations) {
				if (!ts.isIdentifier(decl.name)) continue;

				const property = decl.name.text;

				const init = decl.initializer;
				if (!init || !ts.isNewExpression(init)) continue;

				const typeName = checker.getSymbolAtLocation(init.expression)?.getName();
				if (typeName !== 'Provider') continue;

				let key = property;
				let eager = false;
				let hidden = false;

				if (init.arguments?.[0] && ts.isObjectLiteralExpression(init.arguments[0])) {
					for (const prop of init.arguments[0].properties) {
						if (!ts.isPropertyAssignment(prop)) continue;

						const name = prop.name.getText();
						const value = prop.initializer;

						if (name === 'key' && ts.isStringLiteral(value)) key = value.text;
						if (name === 'eager' && value.kind === ts.SyntaxKind.TrueKeyword)
							eager = true;
						if (name === 'hidden' && value.kind === ts.SyntaxKind.TrueKeyword)
							hidden = true;
					}
				}

				contents.push({
					import_path,
					property,
					key,
					eager,
					hidden,
				});
			}
		});
	}

	const code = generateOutput({
		providerMap: Object.values(contents)
			.map((row) => {
				return `'${row.key}': async () => (await import('${row.import_path}')).${row.property}`;
			})
			.join(',\n\t'),
		providersEager: Object.values(contents)
			.filter((r) => r.eager)
			.map((r) => `'${r.key}': '${r.key}'`)
			.join(',\n\t\t'),
		types: Object.values(contents)
			.filter((r) => !r.hidden)
			.map((row) => {
				return `'${row.key}': Awaited<ReturnType<(typeof providers)['${row.key}']>>`;
			})
			.join(';\n\t\t'),
	});

	await mkdir(dirname(join(outputPath)), { recursive: true });
	await writeFile(join(outputPath), code);
};

const watch = async () => {
	const { spawn } = await import('node:child_process');
	const { watch } = await import('node:fs');

	const regenerate = () => {
		return new Promise((resolve, reject) => {
			const generateProcess = spawn(
				process.argv[0],
				[process.argv[1], 'generate', ...process.argv.slice(3)],
				{
					stdio: 'inherit',
					cwd: process.cwd(),
					env: process.env,
				}
			);

			generateProcess.on('exit', resolve);
			generateProcess.on('error', reject);
		});
	};

	let t: NodeJS.Timeout;

	const watcher = watch('.', { recursive: true }, async () => {
		if (t) clearTimeout(t);
		t = setTimeout(() => regenerate(), 500);
	});

	await regenerate();

	process.on('SIGINT', watcher.close);
	process.on('SIGTERM', watcher.close);
};

const commands = { generate, watch };

export const main = async () => {
	const command = process.argv[2];

	const fn = commands[command as keyof typeof commands];
	if (!fn) {
		console.log(`
ZeroDI CLI - A dependency injector autogenerated code

Usage:
	zerodi <command>

Commands:
	generate    Generate code and types
	watch       Watch files changes to generate code
`);
		process.exit(0);
	}

	await fn();
};

main().catch(console.error);
