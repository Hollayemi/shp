import { Daytona } from '@daytonaio/sdk';

async function testDaytonaClient() {
  console.log('Testing Daytona SDK connection...');

  try {
    // Initialize Daytona client
    const daytona = new Daytona({
      apiKey: process.env.DAYTONA_API_KEY!,
    });

    console.log('✅ Daytona client initialized');

    // Create a test sandbox
    console.log('Creating test sandbox...');
    const sandbox = await daytona.create({
      language: 'typescript',
    });

    console.log('✅ Sandbox created:', sandbox.id);

    // Test file operations
    console.log('Testing file operations...');
    const testContent = 'console.log("Hello from Daytona!");';
    await sandbox.fs.uploadFile(Buffer.from(testContent), 'test.js');

    const downloadedContent = await sandbox.fs.downloadFile('test.js');
    console.log('✅ File uploaded and downloaded successfully');

    // Test process execution
    console.log('Testing process execution...');
    const result = await sandbox.process.codeRun('node test.js');
    console.log('✅ Command executed:', result.result);

    // Clean up
    console.log('Cleaning up...');
    await sandbox.delete();
    console.log('✅ Sandbox deleted');

    console.log('🎉 All Daytona tests passed!');

  } catch (error) {
    console.error('❌ Daytona test failed:', error);
    throw error;
  }
}

// Run the test
testDaytonaClient().catch(console.error);
