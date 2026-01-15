import { describe, expect, test } from "vitest";
import path from "node:path";
import {
	generateEnvContent,
	parseEnvFileContent,
	processRawConfigs,
	RawEnvConfig
} from "../src/util";

describe("processRawConfigs", () => {
	const cwd = "/test/project";

	test("should return undefined if no configs are provided", () => {
		expect(processRawConfigs([], cwd)).toBeUndefined();
	});

	test("should merge multiple configs correctly", () => {
		const configs: RawEnvConfig[] = [
			{ target: ".env.test", variables: { VAR1: "value1" } },
			{ variables: { VAR2: "value2" } }
		];
		const result = processRawConfigs(configs, cwd);
		expect(result).toBeDefined();
		expect(result?.target).toBe(path.resolve(cwd, ".env.test"));
		expect(result?.variables).toEqual([
			{ key: "VAR1", value: "value1" },
			{ key: "VAR2", value: "value2" }
		]);
	});

	test("should handle variables in different formats", () => {
		const configs: RawEnvConfig[] = [
			{
				target: ".env.test",
				variables: {
					VAR1: "value1",
					VAR2: { value: "value2", description: "A description" }
				}
			}
		];
		const result = processRawConfigs(configs, cwd);
		expect(result?.variables).toEqual([
			{ key: "VAR1", value: "value1" },
			{ key: "VAR2", value: "value2", description: "A description" }
		]);
	});

	test("should return undefined if target is missing", () => {
		const configs: RawEnvConfig[] = [{ variables: { VAR1: "value1" } }];
		expect(processRawConfigs(configs, cwd)).toBeUndefined();
	});

	test("should return undefined if variables are missing", () => {
		const configs: RawEnvConfig[] = [{ target: ".env.test" }];
		expect(processRawConfigs(configs, cwd)).toBeUndefined();
	});

	test("should handle non-string variable values", () => {
		const configs: RawEnvConfig[] = [
			{
				target: ".env.test",
				variables: {
					VAR_NUM: { value: 123 },
					VAR_BOOL: { value: true, description: "boolean" }
				}
			}
		];
		const result = processRawConfigs(configs, cwd);
		expect(result?.variables).toEqual([
			{ key: "VAR_NUM", value: "123" },
			{ key: "VAR_BOOL", value: "true", description: "boolean" }
		]);
	});
});

describe("parseEnvFileContent", () => {
	test("should parse basic key-value pairs", () => {
		const content = "VAR1=value1\nVAR2=value2";
		const result = parseEnvFileContent(content);
		expect(result).toEqual([
			{ key: "VAR1", value: "value1" },
			{ key: "VAR2", value: "value2" }
		]);
	});

	test("should handle comments and empty lines", () => {
		const content = `# Comment\nVAR1=value1\n\nVAR2=value2`;
		const result = parseEnvFileContent(content);
		expect(result).toEqual([
			{ key: "VAR1", value: "value1", description: "Comment" },
			{ key: "VAR2", value: "value2" }
		]);
	});

	test("should handle multi-line comments", () => {
		const content = `# Line 1\n# Line 2\nVAR1=value1`;
		const result = parseEnvFileContent(content);
		expect(result).toEqual([
			{ key: "VAR1", value: "value1", description: "Line 1\nLine 2" }
		]);
	});

	test("should handle quoted values", () => {
		const content = `VAR1="value with spaces"\nVAR2="escaped\\"quote"`;
		const result = parseEnvFileContent(content);
		expect(result).toEqual([
			{ key: "VAR1", value: "value with spaces" },
			{ key: "VAR2", value: 'escaped"quote' }
		]);
	});

	test("should treat invalid lines as plain strings", () => {
		const content = "invalid-line\n# comment\nVAR1=value1";
		const result = parseEnvFileContent(content);
		expect(result).toEqual([
			"invalid-line",
			{ key: "VAR1", value: "value1", description: "comment" }
		]);
	});

	test("should treat comments before invalid line as text", () => {
		const content = "# some comment\ninvalid-line\nVAR1=value1";
		const result = parseEnvFileContent(content);
		expect(result).toEqual([
			"# some comment",
			"invalid-line",
			{ key: "VAR1", value: "value1" }
		]);
	});
});

describe("generateEnvContent", () => {
	test("should generate content for new variables", () => {
		const envConfig = {
			target: ".env",
			overrideDescription: false,
			variables: [{ key: "VAR1", value: "value1" }]
		};
		const currentEnv = [];
		const result = generateEnvContent(envConfig, currentEnv);
		expect(result).toBe("VAR1=value1\n");
	});

	test("should add new variables to existing content", () => {
		const envConfig = {
			target: ".env",
			overrideDescription: false,
			variables: [{ key: "VAR2", value: "value2" }]
		};
		const currentEnv = [{ key: "VAR1", value: "value1" }];
		const result = generateEnvContent(envConfig, currentEnv);
		expect(result).toContain("VAR1=value1");
		expect(result).toContain("VAR2=value2");
	});

	test("should update description when overrideDescription is true", () => {
		const envConfig = {
			target: ".env",
			overrideDescription: true,
			variables: [
				{
					key: "VAR1",
					value: "new_value",
					description: "New description"
				}
			]
		};
		const currentEnv = [
			{ key: "VAR1", value: "old_value", description: "Old description" }
		];
		const result = generateEnvContent(envConfig, currentEnv);
		expect(result).toContain("# New description\nVAR1=old_value");
	});

	test("should not update description when overrideDescription is false", () => {
		const envConfig = {
			target: ".env",
			overrideDescription: false,
			variables: [
				{
					key: "VAR1",
					value: "new_value",
					description: "New description"
				}
			]
		};
		const currentEnv = [
			{ key: "VAR1", value: "old_value", description: "Old description" }
		];
		const result = generateEnvContent(envConfig, currentEnv);
		expect(result).toContain("# Old description\nVAR1=old_value");
	});

	test("should handle values with quotes and newlines", () => {
		const envConfig = {
			target: ".env",
			overrideDescription: false,
			variables: [
				{ key: "VAR1", value: 'value with "quotes"' },
				{ key: "VAR2", value: "value with\nnewline" }
			]
		};
		const currentEnv = [];
		const result = generateEnvContent(envConfig, currentEnv);
		expect(result).toContain('VAR1="value with \\"quotes\\""');
		expect(result).toContain('VAR2="value with\\nnewline"');
	});

	test("should preserve other lines and variables with descriptions", () => {
		const envConfig = {
			target: ".env",
			overrideDescription: false,
			variables: [{ key: "VAR2", value: "value2" }]
		};
		const currentEnv = [
			{ key: "VAR1", value: "value1", description: "A comment" },
			"some other line"
		];
		const result = generateEnvContent(envConfig, currentEnv);
		expect(result).toContain("# A comment\nVAR1=value1");
		expect(result).toContain("some other line");
		expect(result).toContain("VAR2=value2");
	});
});
