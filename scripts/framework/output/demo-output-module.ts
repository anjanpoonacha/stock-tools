/**
 * Comprehensive demonstration of the Output & Logging Module
 * 
 * This script demonstrates:
 * 1. LogFormatter with colored output
 * 2. FileWriter creating nested directories
 * 3. OutputManager coordinating file + console output
 * 4. CSV export working correctly
 */

import { OutputManager, LogFormatter, FileWriter } from './index';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// ES module __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Demo directory
const demoDir = join(__dirname, '_demo_output');

console.log('🎯 OUTPUT MODULE DEMONSTRATION\n');

// =============================================================================
// DEMO 1: LogFormatter - Colored Console Output
// =============================================================================
console.log('📝 DEMO 1: LogFormatter - Colored Console Output\n');

const formatter = new LogFormatter();

formatter.section('Main Section Header');
formatter.subsection('Subsection Header');
formatter.success('Operation completed successfully');
formatter.error('An error occurred');
formatter.warning('This is a warning message');
formatter.info('This is an informational message');
formatter.debug('Debug information for developers');
formatter.detail('Key', 'Value');
formatter.detail('Object', { foo: 'bar', nested: { value: 123 } });
formatter.raw('Raw message without any formatting');
formatter.newline();

// =============================================================================
// DEMO 2: FileWriter - Creating Nested Directories
// =============================================================================
console.log('\n📁 DEMO 2: FileWriter - Creating Nested Directories\n');

const nestedPath = join(demoDir, 'deeply', 'nested', 'directory', 'test.json');
formatter.info(`Creating file at: ${nestedPath}`);

FileWriter.writeJSON(nestedPath, { message: 'Hello from nested directory!' }, true);
formatter.success(`File created at: ${nestedPath}`);
formatter.detail('File exists', FileWriter.exists(nestedPath));

// Write plain text file
const textPath = join(demoDir, 'sample.txt');
FileWriter.writeText(textPath, 'This is a plain text file.\nWith multiple lines.\n');
formatter.success(`Text file created at: ${textPath}`);

// Append to log file
const logPath = join(demoDir, 'application.log');
FileWriter.appendLog(logPath, 'Application started');
FileWriter.appendLog(logPath, 'User logged in');
FileWriter.appendLog(logPath, 'Data fetched successfully');
formatter.success(`Log file created at: ${logPath}`);

formatter.newline();

// =============================================================================
// DEMO 3: CSV Export with Proper Escaping
// =============================================================================
console.log('📊 DEMO 3: CSV Export with Proper Escaping\n');

const csvData = [
	{ id: 1, name: 'John Doe', email: 'john@example.com', notes: 'Regular data' },
	{ id: 2, name: 'Jane Smith', email: 'jane@example.com', notes: 'Contains, commas, here' },
	{ id: 3, name: 'Bob "The Builder" Jones', email: 'bob@example.com', notes: 'Contains "quotes"' },
	{
		id: 4,
		name: 'Alice',
		email: 'alice@example.com',
		notes: 'Both, comma and "quotes" together',
	},
];

const csvPath = join(demoDir, 'users.csv');
FileWriter.writeCSV(csvPath, csvData);
formatter.success(`CSV file created at: ${csvPath}`);
formatter.info('CSV properly escapes commas and quotes');

formatter.newline();

// =============================================================================
// DEMO 4: OutputManager - Coordinating File + Console Output
// =============================================================================
console.log('🎛️  DEMO 4: OutputManager - Coordinating File + Console Output\n');

const outputManager = new OutputManager({
	directory: join(demoDir, 'output-manager'),
	saveToFile: true,
	prettyPrint: true,
	logFile: join(demoDir, 'output-manager', 'app.log'),
});

// Access the logger for formatted output
const logger = outputManager.getLogger();

logger.section('OutputManager Demo');

// Log messages at different levels
outputManager.log('info', 'Starting operation');
outputManager.log('success', 'Step 1 completed');
outputManager.log('warning', 'Non-critical issue detected');
outputManager.log('debug', 'Variable state: initialized');
outputManager.log('error', 'Sample error for demonstration');

logger.newline();

// Save result to JSON
await outputManager.saveResult('demo-result.json', {
	status: 'success',
	timestamp: new Date().toISOString(),
	data: {
		recordsProcessed: 150,
		errors: 0,
		warnings: 2,
	},
});

// Save CSV data
await outputManager.saveCSV('demo-data.csv', [
	{ product: 'Widget A', quantity: 100, price: 19.99 },
	{ product: 'Widget B', quantity: 50, price: 29.99 },
	{ product: 'Gadget, Premium', quantity: 25, price: 99.99 },
]);

// Save all logged messages
await outputManager.saveLogMessages('all-logs.json');

logger.success('All files saved to output directory');
logger.detail('Output directory', outputManager.getOutputDir());
logger.detail('Total log messages', outputManager.getLogMessages().length);

logger.newline();

// =============================================================================
// DEMO 5: Pretty Print Toggle
// =============================================================================
console.log('🎨 DEMO 5: Pretty Print Toggle\n');

const compactManager = new OutputManager({
	directory: join(demoDir, 'compact-output'),
	saveToFile: true,
	prettyPrint: false, // Compact JSON
});

await compactManager.saveResult('compact.json', {
	data: [1, 2, 3, 4, 5],
	nested: { a: 1, b: 2 },
});

const prettyManager = new OutputManager({
	directory: join(demoDir, 'pretty-output'),
	saveToFile: true,
	prettyPrint: true, // Pretty-printed JSON
});

await prettyManager.saveResult('pretty.json', {
	data: [1, 2, 3, 4, 5],
	nested: { a: 1, b: 2 },
});

formatter.success('Compact JSON saved (prettyPrint: false)');
formatter.success('Pretty JSON saved (prettyPrint: true)');

formatter.newline();

// =============================================================================
// Summary
// =============================================================================
formatter.section('Demo Complete');
formatter.success('All output module features demonstrated successfully');
formatter.info('Check the following directories for output files:');
formatter.detail('Demo directory', demoDir);
formatter.detail('Nested files', join(demoDir, 'deeply', 'nested', 'directory'));
formatter.detail('Output manager files', join(demoDir, 'output-manager'));
formatter.detail('Compact JSON', join(demoDir, 'compact-output'));
formatter.detail('Pretty JSON', join(demoDir, 'pretty-output'));

formatter.newline();
formatter.raw('✨ Output module is ready for use in POC scripts!');
