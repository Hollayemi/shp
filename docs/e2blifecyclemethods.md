Read & write files
Reading files
You can read files from the sandbox filesystem using the files.read() method.


JavaScript & TypeScript

Python
import { Sandbox } from '@e2b/code-interpreter'
const sandbox = await Sandbox.create()
const fileContent = await sandbox.files.read('/path/to/file')

Copy
Copied!
Writing single files
You can write single files to the sandbox filesystem using the files.write() method.


JavaScript & TypeScript

Python
import { Sandbox } from '@e2b/code-interpreter'
const sandbox = await Sandbox.create()

await sandbox.files.write('/path/to/file', 'file content')

Copy
Copied!
Writing multiple files
You can also write multiple files to the sandbox filesystem using the files.write() method.


JavaScript & TypeScript

Python
import { Sandbox } from '@e2b/code-interpreter'
const sandbox = await Sandbox.create()

await sandbox.files.write([
    { path: '/path/to/a', data: 'file content' },
    { path: '/another/path/to/b', data: 'file content' }
])

import { Sandbox, FilesystemEventType } from '@e2b/code-interpreter'

const sandbox = await Sandbox.create()
const dirname = '/home/user'

// Start watching directory for changes
const handle = await sandbox.files.watchDir(dirname, async (event) => { 
  console.log(event) 
  if (event.type === FilesystemEventType.WRITE) { 
    console.log(`wrote to file ${event.name}`) 
  } 
}) 

// Trigger file write event
await sandbox.files.write(`${dirname}/my-file`, 'hello')

Copy
Copied!
Recursive Watching
You can enable recursive watching using the parameter recursive.

When rapidly creating new folders (e.g., deeply nested path of folders), events other than CREATE might not be emitted. To avoid this behavior, create the required folder structure in advance.


JavaScript & TypeScript

Python
import { Sandbox, FilesystemEventType } from '@e2b/code-interpreter'

const sandbox = await Sandbox.create()
const dirname = '/home/user'

// Start watching directory for changes
const handle = await sandbox.files.watchDir(dirname, async (event) => {
  console.log(event)
  if (event.type === FilesystemEventType.WRITE) {
    console.log(`wrote to file ${event.name}`)
  }
}, {
  recursive: true 
})

// Trigger file write event
await sandbox.files.write(`${dirname}/my-folder/my-file`, 'hello') 

import { Sandbox } from '@e2b/code-interpreter'

const sandbox = await Sandbox.create()
const result = await sandbox.commands.run('ls -l')
console.log(result)

Sandbox lifecycle
When you start the sandbox, it stays alive for 5 minutes by default but you can change it by passing the timeout parameter. After the time passes, the sandbox will be automatically shutdown.


JavaScript & TypeScript

Python
import { Sandbox } from '@e2b/code-interpreter'

// Create sandbox with and keep it running for 60 seconds.
// 🚨 Note: The units are milliseconds.
const sandbox = await Sandbox.create({
  timeoutMs: 60_000, 
})

Copy
Copied!
Change sandbox timeout during runtime
You can change the sandbox timeout when it's running by calling the the setTimeout method in JavaScript or set_timeout method in Python.

When you call the set timeout method, the sandbox timeout will be reset to the new value that you specified.

This can be useful if you want to extend the sandbox lifetime when it's already running. You can for example start with a sandbox with 1 minute timeout and then periodically call set timout every time user interacts with it in your app.


JavaScript & TypeScript

Python
import { Sandbox } from '@e2b/code-interpreter'

// Create sandbox with and keep it running for 60 seconds.
const sandbox = await Sandbox.create({ timeoutMs: 60_000 })

// Change the sandbox timeout to 30 seconds.
// 🚨 The new timeout will be 30 seconds from now.
await sandbox.setTimeout(30_000)

Copy
Copied!
Retrieve sandbox information
You can retrieve sandbox information like sandbox ID, template, metadata, started at/end at date by calling the getInfo method in JavaScript or get_info method in Python.


JavaScript & TypeScript

Python
import { Sandbox } from '@e2b/code-interpreter'

// Create sandbox with and keep it running for 60 seconds.
const sandbox = await Sandbox.create({ timeoutMs: 60_000 })

// Retrieve sandbox information.
const info = await sandbox.getInfo()

console.log(info)

// {
//   "sandboxId": "iiny0783cype8gmoawzmx-ce30bc46",
//   "templateId": "rki5dems9wqfm4r03t7g",
//   "name": "base",
//   "metadata": {},
//   "startedAt": "2025-03-24T15:37:58.076Z",
//   "endAt": "2025-03-24T15:42:58.076Z"
// }

Copy
Copied!
Shutdown sandbox
You can shutdown the sandbox any time even before the timeout is up by calling the kill method.


JavaScript & TypeScript

Python
import { Sandbox } from '@e2b/code-interpreter'

// Create sandbox with and keep it running for 60 seconds.
const sandbox = await Sandbox.create({ timeoutMs: 60_000 })

// Shutdown the sandbox immediately.
await sandbox.kill()

Sandbox metadata
Metadata is a way to attach arbitrary key-value pairs for a sandbox.

This is useful in various scenarios, for example:

Associate a sandbox with a user session.
Store custom user data for a sandbox like API keys.
Associate a sandbox with a user ID and connect to it later.
You specify metadata when creating a sandbox and can access it later through listing running sandboxes with Sandbox.list() method.

If you're using the beta version of the SDK, the Sandbox.list() method was updated. See List Sandboxes for more information.


JavaScript & TypeScript

Python
import { Sandbox } from '@e2b/code-interpreter'

// Create sandbox with metadata.
const sandbox = await Sandbox.create({
  metadata: {
    userId: '123', 
  },
})

// List running sandboxes and access metadata.
const runningSandboxes = await Sandbox.list()
// Will print:
// {
//   'userId': '123',
// }
console.log(runningSandboxes[0].metadata)

You can list sandboxes using the Sandbox.list() method.

Once you have information about running sandbox, you can connect to it using the Sandbox.connect() method.


JavaScript & TypeScript

Python
import { Sandbox } from '@e2b/code-interpreter'

// Create a sandbox.
const sandbox = await Sandbox.create({
  metadata: {
    name: 'My Sandbox',
  },
})

// List all running sandboxes.
const runningSandboxes = await Sandbox.list() 
const runningSandbox = runningSandboxes[0]

console.log('Running sandbox metadata:', runningSandbox.metadata)
console.log('Running sandbox id:', runningSandbox.sandboxId)
console.log('Running sandbox started at:', runningSandbox.startedAt)
console.log('Running sandbox template id:', runningSandbox.templateId)

Copy
Copied!
The code above will output something like this:


JavaScript & TypeScript

Python
Terminal
Running sandbox metadata: {
  name: "My Sandbox",
}
Running sandbox id: ixjj3iankaishgcge4jwn-b0b684e9
Running sandbox started at: 2024-10-15T21:13:07.311Z
Running sandbox template id: 3e4rngfa34txe0gxc1zf

Copy
Copied!
Filtering sandboxes
You can filter sandboxes by specifying Metadata key value pairs. Specifying multiple key value pairs will return sandboxes that match all of them.

This can be useful when you have a large number of sandboxes and want to find only specific ones. The filtering is performed on the server.


JavaScript & TypeScript

Python
import { Sandbox } from '@e2b/code-interpreter'

// Create sandbox with metadata.
const sandbox = await Sandbox.create({
  metadata: {
    env: 'dev', 
    app: 'my-app', 
    userId: '123', 
  },
})

// List running sandboxes that has `userId` key with value `123` and `env` key with value `dev`.
const runningSandboxes = await Sandbox.list({
  query: {
    metadata: { userId: '123', env: 'dev' }, 
  },
})

Copy
Copied!
Changes in the Beta SDKs
If you're using the beta version of the SDK, the Sandbox.list() method was updated.

Listing sandboxes
The Sandbox.list() method now supports pagination. In the advanced pagination section, you can find more information about pagination techniques using the updated method.


JavaScript & TypeScript

Python
import { Sandbox, SandboxInfo } from '@e2b/code-interpreter'

const sandbox = await Sandbox.create()

const paginator = Sandbox.list() 

// Get the first page of sandboxes (running and paused)
const firstPage = await paginator.nextItems() 

// Get the next page of sandboxes
const nextPage = await paginator.nextItems() 

Copy
Copied!
Filtering sandboxes
Filter sandboxes by their current state. The state parameter can contain either "running" for running sandboxes or "paused" for paused sandboxes, or both.


JavaScript & TypeScript

Python
import { Sandbox } from '@e2b/code-interpreter'

// Create a sandbox.
const sandbox = await Sandbox.create()

// List all sandboxes that are running or paused.
const paginator = Sandbox.list({
  query: {
    state: ['running', 'paused'], 
  },
})

const sandboxes = await paginator.nextItems() 

Copy
Copied!
Filter sandboxes by the metadata key value pairs specified during Sandbox creation.


JavaScript & TypeScript

Python
import { Sandbox } from '@e2b/code-interpreter'

// Create sandbox with metadata.
const sandbox = await Sandbox.create({
  metadata: {
    env: 'dev', 
    app: 'my-app', 
    userId: '123', 
  },
})

// List all sandboxes that has `userId` key with value `123` and `env` key with value `dev`.
const paginator = Sandbox.list({
  query: {
    metadata: { userId: '123', env: 'dev' }, 
  },
})

const sandboxes = await paginator.nextItems() 

Copy
Copied!
Advanced pagination
For more granular pagination, you can set custom per-page item limit (default and maximum is 1000) and specify an offset parameter (nextToken or next_token) to start paginating from.


JavaScript & TypeScript

Python
import { Sandbox } from '@e2b/code-interpreter'

const paginator = Sandbox.list({
  limit: 1000, 
  nextToken: '<base64-encoded-token>', 
})

// Additional paginator properties
// Whether there is a next page
paginator.hasNext

// Next page token
paginator.nextToken

// Fetch the next page
await paginator.nextItems()

Copy
Copied!
You can fetch all pages by looping through the paginator while checking if there is a next page (using hasNext or has_next property) and fetching until there are no more pages left to fetch:


JavaScript & TypeScript

Python
import { Sandbox } from '@e2b/code-interpreter'

const paginator = Sandbox.list()

// Loop through all pages
const sandboxes: SandboxInfo[] = []
while (paginator.hasNext) { 
  const items = await paginator.nextItems()
  sandboxes.push(...items)
}

Connect to running sandbox
If you have a running sandbox, you can connect to it using the Sandbox.connect() method and then start controlling it with our SDK.

This is useful if you want to, for example, reuse the same sandbox instance for the same user after a short period of inactivity.

1. Get the sandbox ID
To connect to a running sandbox, you first need to retrieve its ID. You can do this by calling the Sandbox.list() method.

If you're using the beta version of the SDKs, the Sandbox.list() method was updated. See List Sandboxes for more information.


JavaScript & TypeScript

Python
import { Sandbox } from "@e2b/code-interpreter"

// Get all running sandboxes
const runningSandboxes = await Sandbox.list() 

if (runningSandboxes.length === 0) {
  throw new Error("No running sandboxes found")
}

// Get the ID of the sandbox you want to connect to
const sandboxId = runningSandboxes[0].sandboxId

Copy
Copied!
2. Connect to the sandbox
Now that you have the sandbox ID, you can connect to the sandbox using the Sandbox.connect() method.


JavaScript & TypeScript

Python
import { Sandbox } from "@e2b/code-interpreter"

// Get all running sandboxes
const runningSandboxes = await Sandbox.list()

if (runningSandboxes.length === 0) {
  throw new Error("No running sandboxes found")
}

// Get the ID of the sandbox you want to connect to
const sandboxId = runningSandboxes[0].sandboxId

// Connect to the sandbox
const sandbox = await Sandbox.connect(sandboxId) 
// Now you can use the sandbox as usual
// ...


