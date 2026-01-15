import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const __dirname = process.cwd();

let isDebug = false;

export function setDebug(debug: boolean) {
	isDebug = debug;
}

function log(...args: any[]) {
	if (isDebug) {
		console.log("[DEBUG]", ...args);
	}
}

interface EnvVariable {
	key: string;
	value: string;
	description?: string[];
}

interface EnvConfig {
	target: string;
	overrideDescription: boolean;
	variables: EnvVariable[];
}

interface RawEnvVariableObject {
	value: any;
	description?: string;
}

type DefineEnvVariables =
	| Record<string, string | RawEnvVariableObject>
	| (EnvVariable | { key: string; value: any; description?: string })[];

export interface RawEnvConfig {
	target?: string;
	overrideDescription?: boolean;
	variables?: DefineEnvVariables;
}

type ParsedEnvItem = string | EnvVariable;

const CONFIG_FILES = [
	"env.config.mjs",
	"env.config.cjs",
	"env.config.js",
	"env.config.json"
];

function isValidRawConfig(config: any): config is RawEnvConfig {
	if (typeof config !== "object" || config === null) {
		return false;
	}
	if (config.target && typeof config.target !== "string") {
		return false;
	}
	if (
		config.overrideDescription &&
		typeof config.overrideDescription !== "boolean"
	) {
		return false;
	}
	if (config.variables && typeof config.variables !== "object") {
		return false;
	}
	return true;
}

export async function loadRawConfigs(
	cwd: string
): Promise<RawEnvConfig[]> {
	log("Loading raw configs from", cwd);
	const configs: RawEnvConfig[] = [];

	for (const configFile of CONFIG_FILES) {
		const configPath = path.resolve(cwd, configFile);
		if (fs.existsSync(configPath)) {
			log(`Found ${configPath}`);
			try {
				let configData: any;
				if (configFile.endsWith(".json")) {
					const envConfigContent = fs.readFileSync(configPath, "utf-8");
					configData = JSON.parse(envConfigContent);
				} else {
					const configModule = await import(pathToFileURL(configPath).href);
					configData = configModule.default || configModule;
				}
				if (isValidRawConfig(configData)) {
					configs.push(configData);
					log(`Loaded valid config from ${configFile}`);
				} else {
					log(`Invalid config structure in ${configFile}`);
				}
			} catch (error) {
				log(`Error loading config file ${configFile}:`, error);
			}
		}
	}
	return configs;
}

export function processRawConfigs(
	configs: RawEnvConfig[],
	cwd: string
): EnvConfig | undefined {
	log(`Processing ${configs.length} configs`);
	if (configs.length === 0) {
		return;
	}

	const mergedConfig: any = {};

	for (const config of configs) {
		const { variables, ...rest } = config;
		Object.assign(mergedConfig, rest);
		if (variables) {
			const varsToMerge = Array.isArray(variables)
				? variables.reduce(
						(acc, v) => {
							const { key, value, description } = v;
							acc[key] = description ? { value, description } : value;
							return acc;
						},
						{} as Record<string, any>
				  )
				: variables;
			mergedConfig.variables = {
				...(mergedConfig.variables || {}),
				...varsToMerge
			};
		}
	}

	const envConfig = mergedConfig;

	if (!envConfig.target) {
		log("Missing target in processed config");
		return;
	}

	if (!envConfig.variables) {
		log("Missing variables in processed config");
		return;
	}

	const result = {
		target: path.resolve(cwd, envConfig.target),
		overrideDescription: envConfig.overrideDescription || false,
		variables: transformEnvVariables(envConfig.variables)
	};
	log("Processed config:", JSON.stringify(result, null, 2));
	return result;
}

async function parseEnvConfig(): Promise<EnvConfig | undefined> {
	const rawConfigs = await loadRawConfigs(__dirname);
	return processRawConfigs(rawConfigs, __dirname);
}

export function transformEnvVariables(
	variables: DefineEnvVariables
): EnvVariable[] {
	if (Array.isArray(variables)) {
		return variables.map((variable) => {
			const description = variable.description;
			return {
				...variable,
				value: String(variable.value),
				description:
					typeof description === "string"
						? description.split("\n")
						: description
			};
		});
	}
	if (typeof variables === "object") {
		return Object.entries(variables).map(([key, value]) => {
			if (typeof value === "string") {
				return { key, value };
			}
			return {
				key,
				value: String(value.value),
				description: value.description
					? value.description.split("\n")
					: undefined
			};
		});
	}
	return [];
}

export function generateEnvContent(
	envConfig: EnvConfig,
	currentEnv: ParsedEnvItem[]
) {
	log("Generating env content");
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
		if (
			configVariable &&
			envConfig.overrideDescription &&
			configVariable.description
		) {
			const newDesc = configVariable.description;
			const currentDesc = item.description || [];

			let finalDesc: string[];
			if (currentDesc.length > newDesc.length) {
				const keepCount = currentDesc.length - newDesc.length;
				finalDesc = [...currentDesc.slice(0, keepCount), ...newDesc];
			} else {
				finalDesc = newDesc;
			}

			return {
				...item,
				description: finalDesc
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
					? item.description.map((line) => `# ${line}`).join("\n")
					: "";
				return `${description ? `${description}\n` : ""}${item.key}=${
					/"|\n/.test(item.value) ? JSON.stringify(item.value) : item.value
				}`;
			})
			.join("\n") + "\n";
  return fileContent;
}

const KEY_REGEXP = /^[a-zA-Z_]+[a-zA-Z0-9_]*$/;

export function isValidKey(key: string) {
  return !!key && KEY_REGEXP.test(key);
}

export function parseEnvFileContent(fileContent: string): ParsedEnvItem[] {
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
			let value = line.substring(equalSignIndex + 1);

			if (isValidKey(key)) {
				if (
					value.length >= 2 &&
					value.startsWith('"') &&
					value.endsWith('"')
				) {
					try {
						value = JSON.parse(value);
					} catch {
						// Not a valid JSON string, leave as is.
					}
				}
				const config: EnvVariable = { key, value };
				if (commentBuffer.length > 0) {
					config.description = [...commentBuffer];
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

function parseCurrentEnvFull(filePath: string): ParsedEnvItem[] {
	log(`Reading current env file from ${filePath}`);
	if (!fs.existsSync(filePath)) {
		log("Current env file not found");
		return [];
	}
	const fileContent = fs.readFileSync(filePath, "utf-8");
	return parseEnvFileContent(fileContent);
}

export async function parseAndGenerateEnv() {
	const envConfig = await parseEnvConfig();
	if (!envConfig) {
		console.error("env.config.{mjs,cjs,js,json} not found or invalid.");
		return;
	}
	const currentEnv = parseCurrentEnvFull(envConfig.target);
	return {
    target: envConfig.target,
    content: generateEnvContent(envConfig, currentEnv)
  }
}

