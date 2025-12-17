import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = process.cwd();

interface EnvVariable {
	key: string;
	value: string;
	description?: string;
}

interface EnvConfig {
	target: string;
	overrideDescription: boolean;
	variables: EnvVariable[];
}

type ParsedEnvItem = string | EnvVariable;

function parseEnvConfig(): EnvConfig | undefined {
	const envConfigPath = path.resolve(__dirname, "env.config.json");
	if (!fs.existsSync(envConfigPath)) {
		return;
	}
	const envConfigContent = fs.readFileSync(envConfigPath, "utf-8");

	const envConfig = JSON.parse(envConfigContent);

	if (!envConfig.target || typeof envConfig.target !== "string") {
		return;
	}

	if (!envConfig.variables || typeof envConfig.variables !== "object") {
		return;
	}

	return {
		target: path.resolve(__dirname, envConfig.target),
		overrideDescription: envConfig.overrideDescription || false,
		variables: transformEnvVariables(envConfig.variables)
	};
}

function transformEnvVariables(
	variables: Record<string, string | Omit<EnvVariable, "key">> | EnvVariable[]
): EnvVariable[] {
	if (Array.isArray(variables)) {
		return variables;
	} else if (typeof variables === "object") {
		return Object.entries(variables).map(([key, value]) => {
			return typeof value === "string"
				? {
						key,
						value
				  }
				: {
						key,
						...(value as Omit<EnvVariable, "key">)
				  };
		});
	} else {
		return [];
	}
}

function generateEnvContent(
	envConfig: EnvConfig,
	currentEnv: ParsedEnvItem[]
) {
	if (!envConfig) {
		return;
	}

	const variablesMap = new Map(envConfig.variables.map((v) => [v.key, v]));
	const currentEnvKeys = new Set(
		currentEnv
			.filter((item): item is EnvVariable => typeof item === "object")
			.map((item) => item.key)
	);

	const updatedEnv = currentEnv.map((item) => {
		if (typeof item === "string") {
			return item;
		}

		const configVariable = variablesMap.get(item.key);
		if (configVariable && envConfig.overrideDescription) {
			return {
				...item,
				description: configVariable.description
			};
		}
		return item;
	});

	envConfig.variables.forEach((variable) => {
		if (!currentEnvKeys.has(variable.key)) {
			updatedEnv.push(variable);
		}
	});

	const fileContent =
		updatedEnv
			.map((item) => {
				if (typeof item === "string") {
					return item;
				}
				const description = item.description
					? item.description
							.split("\n")
							.map((line) => `# ${line}`)
							.join("\n")
					: "";
				return `${description ? `${description}\n` : ""}${item.key}=${
					/"|\n/.test(item.value) ? JSON.stringify(item.value) : item.value
				}`;
			})
			.join("\n") + "\n";
  return fileContent;
}

const KEY_REGEXP = /^[a-zA-Z_]+[a-zA-Z0-9_]*$/;

function isValidKey(key: string) {
  return !!key && KEY_REGEXP.test(key);
}

function parseCurrentEnvFull(filePath: string): ParsedEnvItem[] {
	if (!fs.existsSync(filePath)) {
		return [];
	}
	const fileContent = fs.readFileSync(filePath, "utf-8");
	const lines = fileContent.split(/\r?\n/);

	const result: ParsedEnvItem[] = [];
	let commentBuffer: string[] = [];

	for (const line of lines) {
		if (!line.trim()) {
      // ignore empty lines
			continue;
		} else if (line.startsWith("# ")) {
      // push comment line
			commentBuffer.push(line.substring(2));
		} else {
			const equalSignIndex = line.indexOf("=");
			const key = line.substring(0, equalSignIndex);
			const value = line.substring(equalSignIndex + 1);

			if (isValidKey(key)) {
				const config: EnvVariable = { key, value };
				if (commentBuffer.length > 0) {
					config.description = commentBuffer.join("\n");
				}
				result.push(config);
				commentBuffer = [];
			} else {
        // invalid line will make all comment lines before into text lines
				if (commentBuffer.length > 0) {
					commentBuffer.forEach((comment) =>
						result.push(`# ${comment}`)
					);
					commentBuffer = [];
				}
				result.push(line);
			}
		}
	}

	if (commentBuffer.length > 0) {
		commentBuffer.forEach((comment) => result.push(`# ${comment}`));
	}

	return result;
}

export function initEnv() {
	const envConfig = parseEnvConfig();
	if (!envConfig) {
		console.error("env.config.json not found or invalid.");
		return;
	}
	const currentEnv = parseCurrentEnvFull(envConfig.target);
  const fileContent = generateEnvContent(envConfig, currentEnv);
  console.log(fileContent);
	fs.writeFileSync(envConfig.target, fileContent, "utf-8");
}

