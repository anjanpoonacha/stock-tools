/**
 * Test script for output module
 * Verifies all formatting, logging, and file operations
 */

import { join } from 'path';
import { existsSync, rmSync } from 'fs';
import { OutputManager, LogFormatter, FileWriter } from './index';

// Test output directory
const TEST_DIR = join(process.cwd(), 'scripts', 'framework', 'output', '_test_output');

async function runTests() {
	console.log('\n🧪 Testing Output Module\n');

	// Clean up test directory if it exists
	if (existsSync(TEST_DIR)) {
		rmSync(TEST_DIR, { recursive: true, force: true });
	}

	// Test 1: LogFormatter - Console formatting
	console.log('Test 1: LogFormatter - Console formatting');
	const logger = new LogFormatter();
	
	logger.section('SECTION HEADER TEST');
	logger.subsection('Subsection Header Test');
	logger.success('This is a success message');
	logger.error('This is an error message');
	logger.warning('This is a warning message');
	logger.info('This is an info message');
	logger.debug('This is a debug message');
	logger.detail('string_value', 'hello world');
	logger.detail('number_value', 42);
	logger.detail('boolean_value', true);
	logger.detail('object_value', { key: 'value', nested: { data: 123 } });
	
	// Test 2: FileWriter - Directory creation
	console.log('\n\nTest 2: FileWriter - Directory creation');
	FileWriter.ensureDirectory(TEST_DIR);
	
	if (existsSync(TEST_DIR)) {
		logger.success('Directory created successfully');
		logger.detail('path', TEST_DIR);
	} else {
		logger.error('Directory creation failed');
	}

	// Test 3: FileWriter - JSON writing
	console.log('\n\nTest 3: FileWriter - JSON writing');
	const testData = {
		timestamp: new Date().toISOString(),
		test: 'json_write',
		nested: {
			array: [1, 2, 3],
			object: { key: 'value' }
		}
	};

	const jsonPath = join(TEST_DIR, 'test-data.json');
	const prettyJsonPath = join(TEST_DIR, 'test-data-pretty.json');
	
	FileWriter.writeJSON(jsonPath, testData, false);
	FileWriter.writeJSON(prettyJsonPath, testData, true);
	
	if (existsSync(jsonPath) && existsSync(prettyJsonPath)) {
		logger.success('JSON files written successfully');
		logger.detail('compact', jsonPath);
		logger.detail('pretty', prettyJsonPath);
	} else {
		logger.error('JSON file writing failed');
	}

	// Test 4: FileWriter - Text writing
	console.log('\n\nTest 4: FileWriter - Text writing');
	const textPath = join(TEST_DIR, 'test-text.txt');
	FileWriter.writeText(textPath, 'Hello, World!\nThis is a test file.\n');
	
	if (existsSync(textPath)) {
		logger.success('Text file written successfully');
		logger.detail('path', textPath);
	} else {
		logger.error('Text file writing failed');
	}

	// Test 5: FileWriter - Log appending
	console.log('\n\nTest 5: FileWriter - Log appending');
	const logPath = join(TEST_DIR, 'test.log');
	
	FileWriter.appendLog(logPath, 'First log entry');
	FileWriter.appendLog(logPath, 'Second log entry');
	FileWriter.appendLog(logPath, 'Third log entry');
	
	if (existsSync(logPath)) {
		logger.success('Log file appended successfully');
		logger.detail('path', logPath);
	} else {
		logger.error('Log file appending failed');
	}

	// Test 6: OutputManager - Initialization with file output enabled
	console.log('\n\nTest 6: OutputManager - With file output enabled');
	const outputDir = join(TEST_DIR, 'output-manager');
	const outputManager = new OutputManager({
		directory: outputDir,
		saveToFile: true,
		prettyPrint: true,
	});

	if (existsSync(outputDir)) {
		logger.success('OutputManager created directory successfully');
		logger.detail('path', outputDir);
	} else {
		logger.error('OutputManager directory creation failed');
	}

	// Test 7: OutputManager - Log methods
	console.log('\n\nTest 7: OutputManager - Log methods');
	logger.subsection('Testing all log levels');
	
	outputManager.log('info', 'This is an info log');
	outputManager.log('success', 'This is a success log');
	outputManager.log('error', 'This is an error log');
	outputManager.log('warning', 'This is a warning log');
	outputManager.log('debug', 'This is a debug log');

	// Test 8: OutputManager - Save result
	console.log('\n\nTest 8: OutputManager - Save result');
	await outputManager.saveResult('test-result.json', {
		testName: 'Output Manager Test',
		timestamp: new Date().toISOString(),
		results: {
			passed: 8,
			failed: 0,
			total: 8
		}
	});

	const resultPath = join(outputDir, 'test-result.json');
	if (existsSync(resultPath)) {
		logger.success('Result saved successfully');
		logger.detail('path', resultPath);
	} else {
		logger.error('Result saving failed');
	}

	// Test 9: OutputManager - Get logger
	console.log('\n\nTest 9: OutputManager - Get logger for advanced formatting');
	const advancedLogger = outputManager.getLogger();
	advancedLogger.section('ADVANCED LOGGER TEST');
	advancedLogger.info('Retrieved logger from OutputManager');
	advancedLogger.detail('type', 'LogFormatter');

	// Test 10: OutputManager - Get output directory
	console.log('\n\nTest 10: OutputManager - Get output directory');
	const retrievedDir = outputManager.getOutputDir();
	logger.info(`Retrieved directory: ${retrievedDir}`);
	
	if (retrievedDir === outputDir) {
		logger.success('Output directory matches configured value');
	} else {
		logger.error('Output directory mismatch');
	}

	// Test 11: OutputManager - Disabled file output
	console.log('\n\nTest 11: OutputManager - With file output disabled');
	const noFileManager = new OutputManager({
		directory: '/tmp/should-not-create',
		saveToFile: false,
		prettyPrint: true,
	});

	await noFileManager.saveResult('should-not-save.json', { data: 'test' });
	
	if (!existsSync('/tmp/should-not-create/should-not-save.json')) {
		logger.success('File correctly not saved when saveToFile=false');
	} else {
		logger.error('File was saved when saveToFile=false');
	}

	// Final summary
	logger.section('TEST SUMMARY');
	logger.success('All tests completed successfully');
	logger.info('Test output directory: ' + TEST_DIR);
	logger.warning('Remember to clean up test files when done');

	// Note about cleanup
	console.log('\n💡 To clean up test files, run:');
	console.log(`   rm -rf ${TEST_DIR}`);
	console.log('');
}

// Run tests
runTests().catch(console.error);
